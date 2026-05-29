import { Modal, Notice, Setting, setIcon } from 'obsidian';
import Fuse from 'fuse.js';
import { langListRaw } from './bib/cslLangList';
import { matchStoredLanguageToCslLocale } from './bib/zoteroLangNormalize';
import ReferenceList from './main';
import {
  getVaultRoot,
  insertTextInActiveMarkdownNote,
  isAbsoluteFilesystemPath,
  normalizeVaultRelativePath,
} from './helpers';
import { openVaultPdfImportModal } from './zoteroImport/VaultPdfImportModal';
import { resolveVaultPdfAbsolutePath } from './zoteroApi/vaultPaths';
import { openDocumentFromPlugin, openPdfForPlugin } from './readers/openDocument';
import { t } from './lang/helpers';
import {
  displayCitekeyForLibrary,
  resolveCitationKey,
  stripCitationKeyLinesFromExtra,
} from './zoteroApi/zoteroToCsl';
import { resolveAttachmentLinks } from './zoteroApi/attachmentLinks';
import { mountZoteroCreatorsEditor } from './zoteroApi/zoteroCreatorsEditor';
import { getZoteroExtraEditableFields } from './zoteroApi/zoteroItemExtraFields';
import type { StoredZoteroItem, ZoteroStoreSnapshot } from './zoteroApi/types';
import {
  mergeUserAndGroupSnapshots,
  parseStorageItemKey,
  zoteroUriForStorageKey,
} from './zoteroApi/zoteroMerge';
import { getPath, isDesktop } from './platformAdapter';
import { itemTypeBadgeLabel } from './zoteroItemTypeBadge';
import {
  copyAnnotationReferenceNotice,
  formatZoteroAnnotationRowReference,
  resolveVaultPathForZoteroAttachment,
} from './annotations/annotationReference';
import { buildAnnotationRowsFromSnapshot } from './annotations/zoteroAnnotationIndex';
import type { ZoteroAnnotationRow } from './annotations/types';

/** @deprecated Legacy view type — migrated to shell */
export const zoteroLibraryViewType = 'pwc-zotero-library-view';

type RowFlat = {
  key: string;
  stored: StoredZoteroItem;
  title: string;
  citekey: string;
};

type ItemTreeNode = {
  stored: StoredZoteroItem;
  citekey: string;
  title: string;
  labelKind: string;
  /** Pièces jointes (PDF / fichier) affichées sur la ligne parent, pas comme enfants */
  inlineAttachments: StoredZoteroItem[];
  children: ItemTreeNode[];
};

/** Pièces jointes et annotations : pas comme sous-arbre ; les notes sont des lignes enfants dédiées */
const CHILD_TYPES_NOT_IN_TREE = new Set(['attachment', 'annotation']);

/** Types Zotero qui utilisent `publisher` plutôt que `publicationTitle` à l’écriture API */
const ITEM_TYPES_WITH_PUBLISHER = new Set([
  'book',
  'bookSection',
  'thesis',
  'report',
  'manuscript',
  'document',
  'computerProgram',
]);

function formatZoteroWriteError(err: string | undefined): string {
  if (!err) return '';
  if (err === 'created_but_not_in_snapshot')
    return t('created_but_not_in_snapshot');
  return err;
}

const fuseOpts = {
  keys: [
    { name: 'title', weight: 0.45 },
    { name: 'citekey', weight: 0.45 },
    { name: 'key', weight: 0.1 },
  ],
  threshold: 0.38,
  minMatchCharLength: 1,
};

const EMPTY_ZOTERO_SNAPSHOT: ZoteroStoreSnapshot = {
  libraryVersion: 0,
  items: {},
  pendingDeleteKeys: [],
  retryFetchKeys: [],
};

function rowTitle(st: StoredZoteroItem): string {
  const d = st.data;
  const it = String(d.itemType ?? '');
  const raw =
    (typeof d.title === 'string' && d.title.trim()) ||
    (typeof d.shortTitle === 'string' && d.shortTitle.trim()) ||
    '';
  if (raw) return raw;
  if (it === 'note' && typeof d.note === 'string') {
    const plain = d.note.replace(/<[^>]+>/g, '').trim().slice(0, 80);
    return plain || st.key;
  }
  return st.key;
}

export class ZoteroLibraryPanel {
  plugin: ReferenceList;
  private rootEl: HTMLElement;
  private listEl: HTMLElement;
  filterInput: HTMLInputElement;
  searchAnnotationsToggle: HTMLInputElement;
  private fuse: Fuse<RowFlat> | null = null;
  private annFuse: Fuse<ZoteroAnnotationRow> | null = null;
  private flatRows: RowFlat[] = [];
  private annRows: ZoteroAnnotationRow[] = [];
  private treeRoots: ItemTreeNode[] = [];
  /** Pièces jointes par clé parent (vue liste / recherche plate) */
  private attachmentChildrenByParent = new Map<string, StoredZoteroItem[]>();
  private annotationFilterAttachmentKey: string | null = null;
  private annotationFilterAttachmentLabel = '';

  constructor(host: HTMLElement, plugin: ReferenceList) {
    this.plugin = plugin;
    host.empty();
    host.addClass('pwc-zotero-library');
    this.rootEl = host.createDiv({
      cls: 'pwc-zotero-library__inner',
    });
    const headingRow = this.rootEl.createDiv({
      cls: 'pwc-zotero-library__heading-row',
    });
    headingRow.createEl('h4', {
      cls: 'pwc-zotero-library__heading',
      text: t('Zotero library'),
    });
    const headActions = headingRow.createDiv({
      cls: 'pwc-zotero-library__heading-actions',
    });
    const searchWrap = this.rootEl.createDiv({
      cls: 'pwc-zotero-library__search',
    });
    this.filterInput = searchWrap.createEl('input', {
      type: 'search',
      cls: 'pwc-zotero-library__filter',
      attr: { placeholder: t('Filter references…') },
    });
    const annLabel = searchWrap.createEl('label', {
      cls: 'pwc-zotero-library__ann-search-label',
    });
    this.searchAnnotationsToggle = annLabel.createEl('input', {
      type: 'checkbox',
    });
    annLabel.createSpan({ text: t('Search Zotero annotations') });
    let debounceTimer = 0;
    const scheduleRender = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => this.render(), 120);
    };
    this.filterInput.addEventListener('input', scheduleRender);
    this.searchAnnotationsToggle.addEventListener('change', scheduleRender);

    const syncBtn = headActions.createEl('button', {
      cls: 'clickable-icon pwc-zotero-library__head-btn',
      attr: { type: 'button', 'aria-label': t('Sync now'), title: t('Sync now') },
    });
    setIcon(syncBtn, 'refresh-ccw');
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      try {
        const { noticeSyncResult } = await import('./zoteroApi/zoteroSync');
        const r = await this.plugin.zoteroSync.sync();
        noticeSyncResult(r, t);
        await this.plugin.bibManager.loadGlobalZoteroApi();
        this.plugin.bibManager.fileCache.clear();
        this.plugin.processReferences();
        await this.refreshList();
      } finally {
        syncBtn.disabled = false;
      }
    });

    const importPdfBtn = headActions.createEl('button', {
      cls: 'clickable-icon pwc-zotero-library__head-btn',
      attr: {
        type: 'button',
        'aria-label': t('Import vault PDF folder'),
        title: t('Import vault PDF folder'),
      },
    });
    setIcon(importPdfBtn, 'folder-input');
    importPdfBtn.addEventListener('click', () => {
      openVaultPdfImportModal(this.plugin);
    });

    const bibBtn = headActions.createEl('button', {
      cls: 'clickable-icon pwc-zotero-library__head-btn',
      attr: {
        type: 'button',
        'aria-label': t('Export Zotero API library to BibTeX'),
        title: t('Export .bib'),
      },
    });
    setIcon(bibBtn, 'book-marked');
    bibBtn.addEventListener('click', async () => {
      const p = this.plugin.settings.zoteroApiBibExportPath?.trim();
      if (!p) {
        new Notice(t('Set the BibTeX path in Zotero Web API settings'));
        return;
      }
      const { writeBibtexExportToVault } = await import(
        './zoteroApi/zoteroToBibtex'
      );
      const snap = await this.plugin.zoteroSync.loadSnapshot();
      const res = await writeBibtexExportToVault(this.plugin.app, snap, p);
      if (res.ok) {
        new Notice(
          `${t('BibTeX export saved')} (${res.entryCount ?? 0} ${t(
            'entries'
          )}) → ${res.path}`
        );
      } else if (res.error === 'need_bib_extension') {
        new Notice(t('Path must end with .bib'));
      } else {
        new Notice(`${t('Export failed')}: ${res.error ?? ''}`);
      }
    });

    this.listEl = this.rootEl.createDiv({
      cls: 'pwc-zotero-library__list pwc-zotero-library__list--tree',
    });
    void this.refreshList();
  }

  private makeRow(st: StoredZoteroItem): RowFlat {
    const d = st.data as Record<string, unknown>;
    return {
      key: st.key,
      stored: st,
      title: rowTitle(st),
      citekey: displayCitekeyForLibrary(d, st.key),
    };
  }

  /** Carte pièces jointes pour la liste plate filtrée (snapshot fusionné). */
  private fillAttachmentMapFromSnap(snap: ZoteroStoreSnapshot): void {
    const trashedItems: StoredZoteroItem[] = [];
    const active: StoredZoteroItem[] = [];
    for (const st of Object.values(snap.items)) {
      if (st.data.deleted === 1) trashedItems.push(st);
      else active.push(st);
    }
    const byParent = new Map<string, StoredZoteroItem[]>();
    const byParentTrash = new Map<string, StoredZoteroItem[]>();
    for (const st of active) {
      const pid = st.data.parentItem;
      if (typeof pid === 'string') {
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid)!.push(st);
      }
    }
    for (const st of trashedItems) {
      const pid = st.data.parentItem;
      if (typeof pid === 'string') {
        if (!byParentTrash.has(pid)) byParentTrash.set(pid, []);
        byParentTrash.get(pid)!.push(st);
      }
    }
    for (const [pid, list] of byParent) {
      const atts = list.filter(
        (k) => String(k.data.itemType) === 'attachment'
      );
      if (atts.length) this.attachmentChildrenByParent.set(pid, atts);
    }
    for (const [pid, list] of byParentTrash) {
      const atts = list.filter(
        (k) => String(k.data.itemType) === 'attachment'
      );
      if (atts.length) this.attachmentChildrenByParent.set(pid, atts);
    }
  }

  /** Collections / sans classe / fichiers isolés / corbeille pour un snapshot. */
  private snapToLibrarySectionChildren(
    snap: ZoteroStoreSnapshot,
    collNames: Map<string, string>,
    resolveCollKey: (collectionKey: string) => string
  ): ItemTreeNode[] {
    const trashedItems: StoredZoteroItem[] = [];
    const active: StoredZoteroItem[] = [];
    for (const st of Object.values(snap.items)) {
      if (st.data.deleted === 1) trashedItems.push(st);
      else active.push(st);
    }
    const activeByKey = new Map(active.map((s) => [s.key, s] as const));
    const byParent = new Map<string, StoredZoteroItem[]>();
    for (const st of active) {
      const pid = st.data.parentItem;
      if (typeof pid === 'string') {
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid)!.push(st);
      }
    }

    const roots: StoredZoteroItem[] = [];
    for (const st of active) {
      const pid = st.data.parentItem;
      if (typeof pid === 'string') {
        if (activeByKey.has(pid)) continue;
        const pSnap = snap.items[pid];
        if (pSnap?.data?.deleted === 1) continue;
      }
      roots.push(st);
    }

    const trashByKey = new Map(trashedItems.map((s) => [s.key, s] as const));
    const byParentTrash = new Map<string, StoredZoteroItem[]>();
    for (const st of trashedItems) {
      const pid = st.data.parentItem;
      if (typeof pid === 'string') {
        if (!byParentTrash.has(pid)) byParentTrash.set(pid, []);
        byParentTrash.get(pid)!.push(st);
      }
    }
    const trashRoots = trashedItems.filter((st) => {
      const pid = st.data.parentItem;
      if (typeof pid !== 'string') return true;
      return !trashByKey.has(pid);
    });

    const uncategorized: StoredZoteroItem[] = [];
    const looseFiles: StoredZoteroItem[] = [];
    const byColl = new Map<string, StoredZoteroItem[]>();

    for (const st of roots) {
      const it = String(st.data.itemType ?? '');
      const cols = Array.isArray(st.data.collections)
        ? (st.data.collections as string[])
        : [];
      if (it === 'attachment' || it === 'note') {
        looseFiles.push(st);
        continue;
      }
      if (!cols.length) {
        uncategorized.push(st);
        continue;
      }
      const ck = cols[0];
      if (!byColl.has(ck)) byColl.set(ck, []);
      byColl.get(ck)!.push(st);
    }

    const sortSt = (a: StoredZoteroItem, b: StoredZoteroItem) =>
      rowTitle(a).localeCompare(rowTitle(b));

    const buildTreeNode = (st: StoredZoteroItem): ItemTreeNode => {
      const d = st.data as Record<string, unknown>;
      const kidsRaw = (byParent.get(st.key) ?? []).sort(sortSt);
      const inlineAttachments = kidsRaw.filter(
        (k) => String(k.data.itemType) === 'attachment'
      );
      const treeKids = kidsRaw.filter(
        (k) => !CHILD_TYPES_NOT_IN_TREE.has(String(k.data.itemType))
      );
      return {
        stored: st,
        citekey: displayCitekeyForLibrary(d, st.key),
        title: rowTitle(st),
        labelKind: String(st.data.itemType ?? ''),
        inlineAttachments,
        children: treeKids.map(buildTreeNode),
      };
    };

    const mapRoots = (arr: StoredZoteroItem[]) =>
      arr.sort(sortSt).map(buildTreeNode);

    const buildTrashTreeNode = (st: StoredZoteroItem): ItemTreeNode => {
      const d = st.data as Record<string, unknown>;
      const kidsRaw = (byParentTrash.get(st.key) ?? []).sort(sortSt);
      const inlineAttachments = kidsRaw.filter(
        (k) => String(k.data.itemType) === 'attachment'
      );
      const treeKids = kidsRaw.filter(
        (k) => !CHILD_TYPES_NOT_IN_TREE.has(String(k.data.itemType))
      );
      return {
        stored: st,
        citekey: displayCitekeyForLibrary(d, st.key),
        title: rowTitle(st),
        labelKind: String(st.data.itemType ?? ''),
        inlineAttachments,
        children: treeKids.map(buildTrashTreeNode),
      };
    };

    const mapTrashRoots = (arr: StoredZoteroItem[]) =>
      arr.sort(sortSt).map(buildTrashTreeNode);

    const collKeysSorted = Array.from(byColl.keys()).sort((a, b) =>
      (collNames.get(resolveCollKey(a)) ?? a).localeCompare(
        collNames.get(resolveCollKey(b)) ?? b
      )
    );

    const out: ItemTreeNode[] = [];
    for (const ck of collKeysSorted) {
      const name = collNames.get(resolveCollKey(ck)) ?? ck;
      const arr = byColl.get(ck) ?? [];
      out.push({
        stored: {} as StoredZoteroItem,
        citekey: '',
        title: `${t('Collection')}: ${name}`,
        labelKind: 'section',
        inlineAttachments: [],
        children: mapRoots(arr),
      });
    }

    if (uncategorized.length) {
      out.push({
        stored: {} as StoredZoteroItem,
        citekey: '',
        title: `${t('Uncategorized')} (${uncategorized.length})`,
        labelKind: 'section',
        inlineAttachments: [],
        children: mapRoots(uncategorized),
      });
    }

    if (looseFiles.length) {
      out.push({
        stored: {} as StoredZoteroItem,
        citekey: '',
        title: `${t('Loose attachments / notes')} (${looseFiles.length})`,
        labelKind: 'section',
        inlineAttachments: [],
        children: mapRoots(looseFiles),
      });
    }

    if (trashedItems.length) {
      out.push({
        stored: {} as StoredZoteroItem,
        citekey: '',
        title: `${t('Trash')} (${trashedItems.length})`,
        labelKind: 'section',
        inlineAttachments: [],
        children: mapTrashRoots(trashRoots),
      });
    }

    return out;
  }

  async refreshList() {
    const snapMerged = await this.plugin.zoteroSync.loadSnapshot();
    const settings = this.plugin.settings;

    this.flatRows = Object.values(snapMerged.items).map((st) =>
      this.makeRow(st)
    );
    this.fuse = new Fuse(this.flatRows, fuseOpts);
    this.annRows = buildAnnotationRowsFromSnapshot(snapMerged);
    this.annFuse =
      this.annRows.length > 0
        ? new Fuse(this.annRows, {
            keys: [
              { name: 'annotationText', weight: 0.35 },
              { name: 'annotationComment', weight: 0.3 },
              { name: 'parentTitle', weight: 0.15 },
              { name: 'topItemTitle', weight: 0.1 },
              { name: 'citekey', weight: 0.05 },
              { name: 'annotationPageLabel', weight: 0.05 },
            ],
            threshold: 0.38,
            minMatchCharLength: 1,
          })
        : null;

    this.attachmentChildrenByParent.clear();
    this.fillAttachmentMapFromSnap(snapMerged);

    let collNames = new Map<string, string>();
    try {
      collNames = await this.plugin.zoteroSync.fetchCollectionNames();
    } catch {
      //
    }

    const mergeIds = this.plugin.zoteroSync.mergeGroupIdsResolved();
    const dualSection =
      settings.zoteroApiLibraryType === 'user' && mergeIds.length > 0;

    const cache = this.plugin.settings.zoteroApiGroupNamesCache ?? {};
    const needFetchName = mergeIds.some((id) => !cache[String(id)]?.trim());
    if (needFetchName && mergeIds.length) {
      const list = await this.plugin.zoteroSync.fetchGroupLibraries();
      const next = { ...cache };
      for (const g of list) next[String(g.id)] = g.name;
      this.plugin.settings.zoteroApiGroupNamesCache = next;
      await this.plugin.saveSettings();
    }
    const names = this.plugin.settings.zoteroApiGroupNamesCache ?? {};

    this.treeRoots = [];

    if (dualSection) {
      const primarySnap = await this.plugin.zoteroSync.loadPrimarySnapshot();
      this.treeRoots.push({
        stored: {} as StoredZoteroItem,
        citekey: '',
        title: t('My library'),
        labelKind: 'root',
        inlineAttachments: [],
        children: this.snapToLibrarySectionChildren(
          primarySnap,
          collNames,
          (ck) => ck
        ),
      });
      const customLabels = settings.zoteroApiMergeGroupLabels ?? {};
      for (const gid of mergeIds) {
        const rawGroup = await this.plugin.zoteroSync.loadRawGroupSnapshot(gid);
        const groupSnapPrefixed = mergeUserAndGroupSnapshots(
          EMPTY_ZOTERO_SNAPSHOT,
          rawGroup,
          gid
        );
        const gname =
          customLabels[String(gid)]?.trim() || names[String(gid)]?.trim();
        const gtitle = gname
          ? `${t('Group library')}: ${gname}`
          : `${t('Group library')} (${gid})`;
        this.treeRoots.push({
          stored: {} as StoredZoteroItem,
          citekey: '',
          title: gtitle,
          labelKind: 'root',
          inlineAttachments: [],
          children: this.snapToLibrarySectionChildren(
            groupSnapPrefixed,
            collNames,
            (ck) => ck
          ),
        });
      }
    } else {
      const libLabel =
        settings.zoteroApiLibraryType === 'group'
          ? `${t('Group library')} (${settings.zoteroApiGroupId})`
          : t('My library');
      this.treeRoots.push({
        stored: {} as StoredZoteroItem,
        citekey: '',
        title: libLabel,
        labelKind: 'root',
        inlineAttachments: [],
        children: this.snapToLibrarySectionChildren(
          snapMerged,
          collNames,
          (ck) => ck
        ),
      });
    }

    this.render();
  }

  render() {
    const q = this.filterInput?.value?.trim() ?? '';
    this.listEl.empty();

    if (this.searchAnnotationsToggle?.checked) {
      this.renderAnnotationSearch(q);
      return;
    }

    if (q && this.fuse) {
      const hits = this.fuse.search(q).map((r) => r.item);
      if (!hits.length) {
        this.listEl.createDiv({
          cls: 'pwc-zotero-library__empty',
          text: t('No matching references'),
        });
        return;
      }
      this.listEl.createDiv({
        cls: 'pwc-zotero-library__filter-hint',
        text: t('Filtered flat list — clear search for tree'),
      });
      for (const row of hits) {
        this.renderRowFlat(row);
      }
      return;
    }

    for (const node of this.treeRoots) {
      this.renderTreeNode(node, 0);
    }
  }

  private annotationCountForAttachment(attachmentKey: string): number {
    const filterPlain = parseStorageItemKey(attachmentKey).plainKey;
    return this.annRows.filter((row) => {
      if (row.parentAttachmentKey === attachmentKey) return true;
      return (
        parseStorageItemKey(row.parentAttachmentKey).plainKey === filterPlain
      );
    }).length;
  }

  private filterAnnotationRows(rows: ZoteroAnnotationRow[]): ZoteroAnnotationRow[] {
    if (!this.annotationFilterAttachmentKey) return rows;
    const key = this.annotationFilterAttachmentKey;
    return rows.filter((row) => {
      if (row.parentAttachmentKey === key) return true;
      const rowPlain = parseStorageItemKey(row.parentAttachmentKey).plainKey;
      const filterPlain = parseStorageItemKey(key).plainKey;
      return rowPlain === filterPlain;
    });
  }

  showAnnotationsForAttachment(att: StoredZoteroItem): void {
    this.annotationFilterAttachmentKey = att.key;
    this.annotationFilterAttachmentLabel = this.attachmentLinkLabel(att);
    if (this.searchAnnotationsToggle) {
      this.searchAnnotationsToggle.checked = true;
    }
    this.render();
  }

  private renderAnnotationSearch(q: string): void {
    let rows = q
      ? this.annFuse?.search(q).map((r) => r.item) ?? []
      : this.annRows.slice(0, 500);
    rows = this.filterAnnotationRows(rows);
    if (!rows.length) {
      this.listEl.createDiv({
        cls: 'pwc-zotero-library__empty',
        text: q
          ? t('No matching annotations')
          : this.annotationFilterAttachmentKey
            ? t('No annotations for this document')
            : t('No Zotero annotations in library'),
      });
      return;
    }
    if (this.annotationFilterAttachmentKey) {
      const banner = this.listEl.createDiv({
        cls: 'pwc-zotero-library__filter-hint pwc-zotero-library__ann-doc-filter',
      });
      banner.createSpan({
        text: `${t('Annotations for document')}: ${this.annotationFilterAttachmentLabel}`,
      });
      banner
        .createEl('button', {
          cls: 'pwc-zotero-library__ann-doc-filter-clear',
          attr: { type: 'button' },
          text: t('Clear document filter'),
        })
        .addEventListener('click', () => {
          this.annotationFilterAttachmentKey = null;
          this.annotationFilterAttachmentLabel = '';
          this.render();
        });
    } else if (!q) {
      this.listEl.createDiv({
        cls: 'pwc-zotero-library__filter-hint',
        text: t('Type to search all Zotero annotations'),
      });
    }
    for (const row of rows) {
      const wrap = this.listEl.createDiv({
        cls: 'pwc-zotero-library__tree-row pwc-zotero-library__tree-row--flat',
      });
      const rowEl = wrap.createDiv({ cls: 'pwc-zotero-library__row' });
      const meta = rowEl.createDiv({ cls: 'pwc-zotero-library__meta' });
      meta.createDiv({
        cls: 'pwc-zotero-library__badge',
        text: t('Badge annotation'),
      });
      const excerpt =
        row.annotationText.replace(/<[^>]+>/g, '').trim().slice(0, 120) ||
        row.annotationComment.replace(/<[^>]+>/g, '').trim().slice(0, 80) ||
        row.key;
      meta.createDiv({ cls: 'pwc-zotero-library__title', text: excerpt });
      meta.createDiv({
        cls: 'pwc-zotero-library__citekey',
        text: `${row.topItemTitle}${row.citekey ? ` · @${row.citekey}` : ''}${
          row.annotationPageLabel ? ` · p.${row.annotationPageLabel}` : ''
        }`,
      });
      const actions = rowEl.createDiv({ cls: 'pwc-zotero-library__actions' });
      const copyBtn = actions.createEl('button', {
        cls: 'clickable-icon',
        attr: {
          type: 'button',
          'aria-label': t('Copy annotation reference'),
          title: t('Copy annotation reference'),
        },
      });
      setIcon(copyBtn, 'copy');
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void this.copyZoteroAnnotationReference(row);
      });
      rowEl.addEventListener('click', () => {
        void this.openAnnotationTarget(row);
      });
    }
  }

  private async copyZoteroAnnotationReference(
    row: ZoteroAnnotationRow
  ): Promise<void> {
    const vaultPath = await resolveVaultPathForZoteroAttachment(
      this.plugin,
      row.parentAttachmentKey
    );
    if (!vaultPath) {
      new Notice(t('No vault path for this annotation'));
      return;
    }
    const text = formatZoteroAnnotationRowReference(row, vaultPath);
    await copyAnnotationReferenceNotice(text);
  }

  private async openAnnotationTarget(row: ZoteroAnnotationRow): Promise<void> {
    const snap = await this.plugin.zoteroSync.loadSnapshot();
    const parent = snap.items[row.parentAttachmentKey];
    if (!parent) {
      new Notice(t('Attachment not found for annotation'));
      return;
    }
    const d = parent.data as Record<string, unknown>;
    const path =
      (typeof d.path === 'string' && d.path) ||
      (typeof d.url === 'string' && d.url) ||
      '';
    if (!path) {
      new Notice(t('No file path for this annotation'));
      return;
    }
    const page = row.annotationPageLabel
      ? parseInt(row.annotationPageLabel, 10)
      : undefined;
    await openDocumentFromPlugin(this.plugin, path, {
      page: Number.isFinite(page) ? page : undefined,
      zoteroAnnotationKey: row.key,
    });
  }

  private renderTreeNode(node: ItemTreeNode, depth: number) {
    if (node.labelKind === 'root') {
      const h = this.listEl.createDiv({
        cls: 'pwc-zotero-library__tree-root-title',
        text: node.title,
      });
      void h;
      for (const ch of node.children) {
        this.renderTreeNode(ch, depth);
      }
      return;
    }

    if (node.labelKind === 'section') {
      const det = this.listEl.createEl('details', {
        cls: 'pwc-zotero-library__details',
      });
      det.open = false;
      det.createEl('summary', {
        cls: 'pwc-zotero-library__summary',
        text: node.title,
      });
      const inner = det.createDiv({ cls: 'pwc-zotero-library__details-inner' });
      const prev = this.listEl;
      this.listEl = inner;
      for (const ch of node.children) {
        this.renderTreeNode(ch, depth + 1);
      }
      this.listEl = prev;
      return;
    }

    let nestEl: HTMLElement | null = null;
    const hasSubtree = node.children.length > 0;

    const wrap = this.listEl.createDiv({
      cls: 'pwc-zotero-library__tree-row',
      attr: { style: `--pwc-tree-depth: ${depth}` },
    });
    const rowEl = wrap.createDiv({
      cls: 'pwc-zotero-library__row',
    });
    if (node.stored?.conflict) rowEl.addClass('is-conflict');

    const meta = rowEl.createDiv({ cls: 'pwc-zotero-library__meta' });
    meta.createDiv({
      cls: 'pwc-zotero-library__badge',
      text: itemTypeBadgeLabel(String(node.stored?.data?.itemType ?? '')),
    });
    meta.createDiv({ cls: 'pwc-zotero-library__title', text: node.title });
    meta.createDiv({
      cls: 'pwc-zotero-library__citekey',
      text: node.citekey ? `@${node.citekey}` : '',
    });

    const actions = rowEl.createDiv({ cls: 'pwc-zotero-library__actions' });
    this.attachRowActions(actions, node.stored, node.citekey);

    this.renderPdfStripInRow(
      rowEl,
      node.inlineAttachments,
      hasSubtree
        ? {
            getNestEl: () => nestEl,
          }
        : undefined
    );

    if (node.children.length) {
      nestEl = wrap.createDiv({
        cls: 'pwc-zotero-library__tree-nest pwc-zotero-library__tree-nest--collapsed',
      });
      const prev = this.listEl;
      this.listEl = nestEl;
      for (const ch of node.children) {
        this.renderTreeNode(ch, depth + 1);
      }
      this.listEl = prev;
    }
  }

  private renderRowFlat(row: RowFlat) {
    const wrap = this.listEl.createDiv({
      cls: 'pwc-zotero-library__tree-row pwc-zotero-library__tree-row--flat',
    });
    const rowEl = wrap.createDiv({ cls: 'pwc-zotero-library__row' });
    if (row.stored.conflict) rowEl.addClass('is-conflict');
    const meta = rowEl.createDiv({ cls: 'pwc-zotero-library__meta' });
    meta.createDiv({
      cls: 'pwc-zotero-library__badge',
      text: itemTypeBadgeLabel(String(row.stored.data.itemType ?? '')),
    });
    meta.createDiv({ cls: 'pwc-zotero-library__title', text: row.title });
    meta.createDiv({
      cls: 'pwc-zotero-library__citekey',
      text: row.citekey ? `@${row.citekey}` : '',
    });
    const actions = rowEl.createDiv({ cls: 'pwc-zotero-library__actions' });
    this.attachRowActions(actions, row.stored, row.citekey);
    const atts = this.attachmentChildrenByParent.get(row.key);
    if (atts?.length) this.renderPdfStripInRow(rowEl, atts);
  }

  private zoteroSelectUri(itemKey: string): string | null {
    return zoteroUriForStorageKey(itemKey, this.plugin.settings);
  }

  private attachmentLinkLabel(st: StoredZoteroItem): string {
    const d = st.data;
    const fn =
      (typeof d.filename === 'string' && d.filename.trim()) ||
      (typeof d.title === 'string' && d.title.trim()) ||
      rowTitle(st);
    return fn;
  }

  /** Absolu ou joint à la racine du coffre si Zotero enregistre un chemin relatif (comme le modal PJ). */
  private resolveLinkedLocalPathForOpen(input: string): string {
    const pathMod = getPath();
    const v = input.trim();
    if (!v) return '';
    if (!pathMod.isAbsolute(v) && !isAbsoluteFilesystemPath(v)) {
      return normalizeVaultRelativePath(v);
    }
    if (pathMod.isAbsolute(v)) return pathMod.normalize(v);
    const root = getVaultRoot();
    if (!root) return v;
    return pathMod.join(root, v.replace(/^[/\\]+/, ''));
  }

  /** Comme le tooltip des citekeys : `openLinkText` dans le coffre, sinon `file://`. */
  private openLocalPath(p: string) {
    const abs = this.resolveLinkedLocalPathForOpen(p);
    if (!abs) return;
    const source = this.plugin.app.workspace.getActiveFile()?.path ?? '';
    const lower = abs.toLowerCase();
    if (lower.endsWith('.epub')) {
      void openDocumentFromPlugin(this.plugin, abs);
      return;
    }
    void openPdfForPlugin(
      this.plugin,
      abs,
      source,
      null,
      this.plugin.settings.openPdfLinksInNewTab === false ? false : 'tab'
    );
  }

  /** Pièces jointes dans la même ligne que méta / actions (compact, icônes). */
  private renderPdfStripInRow(
    rowEl: HTMLElement,
    attachments: StoredZoteroItem[] | undefined,
    nestToggle?: {
      /** Réf mis à jour après création du `tree-nest` (clics ultérieurs uniquement). */
      getNestEl: () => HTMLElement | null;
    }
  ) {
    const hasPdf = !!(attachments?.length);
    const hasNestToggle = !!nestToggle;
    if (!hasPdf && !hasNestToggle) return;

    const strip = rowEl.createDiv({ cls: 'pwc-zotero-library__pdf-strip' });

    if (hasNestToggle && nestToggle) {
      const getNest = nestToggle.getNestEl;
      const btn = strip.createEl('button', {
        cls: 'clickable-icon pwc-zotero-library__nest-toggle',
        attr: {
          type: 'button',
          'aria-label': t('Toggle library subtree'),
          title: t('Toggle library subtree'),
          'aria-expanded': 'false',
        },
      });
      setIcon(btn, 'chevron-right');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nest = getNest();
        if (!nest) return;
        const collapsed = nest.classList.toggle(
          'pwc-zotero-library__tree-nest--collapsed'
        );
        setIcon(btn, collapsed ? 'chevron-right' : 'chevron-down');
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
    }

    if (!hasPdf || !attachments?.length) return;

    for (const att of attachments) {
      const links = resolveAttachmentLinks(att, this.zoteroSelectUri(att.key));
      const group = strip.createDiv({ cls: 'pwc-zotero-library__pdf-group' });
      const typeIc = group.createSpan({
        cls: 'pwc-zotero-library__pdf-type-ic',
        attr: { 'aria-hidden': 'true' },
      });
      setIcon(typeIc, 'file-text');
      group.createSpan({
        cls: 'pwc-zotero-library__pdf-filename',
        text: this.attachmentLinkLabel(att),
      });
      const annCount = this.annotationCountForAttachment(att.key);
      if (annCount > 0) {
        const annBtn = group.createEl('button', {
          cls: 'clickable-icon pwc-zotero-library__pdf-icon-btn',
          attr: {
            type: 'button',
            title: `${t('Show annotations for this document')} (${annCount})`,
            'aria-label': t('Show annotations for this document'),
          },
        });
        setIcon(annBtn, 'highlighter');
        annBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showAnnotationsForAttachment(att);
        });
      }
      for (const link of links) {
        if (link.kind === 'zotero') {
          const chip = group.createEl('button', {
            cls: 'clickable-icon pwc-zotero-library__pdf-icon-btn',
            attr: {
              type: 'button',
              title: t('Open in Zotero'),
              'aria-label': t('Open in Zotero'),
            },
          });
          setIcon(chip, 'library');
          chip.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(link.href);
          });
        } else if (link.kind === 'local') {
          const chip = group.createEl('button', {
            cls: 'clickable-icon pwc-zotero-library__pdf-icon-btn pwc-zotero-library__pdf-icon-btn--local',
            attr: {
              type: 'button',
              title: link.path,
              'aria-label': t('Local file'),
            },
          });
          setIcon(chip, 'folder-open');
          chip.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openLocalPath(link.path);
          });
        } else {
          const chip = group.createEl('button', {
            cls: 'clickable-icon pwc-zotero-library__pdf-icon-btn',
            attr: {
              type: 'button',
              title: link.href,
              'aria-label': t('Web link'),
            },
          });
          setIcon(chip, 'globe');
          chip.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(link.href);
          });
        }
      }
    }
  }

  private attachRowActions(
    actions: HTMLElement,
    stored: StoredZoteroItem,
    citekey: string
  ) {
    const editBtn = actions.createEl('button', {
      cls: 'clickable-icon pwc-zotero-library__btn-edit',
      attr: { type: 'button', 'aria-label': t('Edit'), title: t('Edit') },
    });
    setIcon(editBtn, 'pencil');
    const afterSave = async () => {
      await this.refreshList();
      await this.plugin.bibManager.loadGlobalZoteroApi();
      this.plugin.bibManager.fileCache.clear();
      this.plugin.processReferences();
    };

    editBtn.addEventListener('click', () => {
      const it = String(stored.data.itemType ?? '');
      if (it === 'note') {
        new ZoteroNoteEditModal(this.plugin, stored, afterSave).open();
        return;
      }
      new ZoteroItemEditModal(this.plugin, stored, afterSave).open();
    });

    const delBtn = actions.createEl('button', {
      cls: 'clickable-icon pwc-zotero-library__btn-delete',
      attr: { type: 'button', 'aria-label': t('Delete') },
    });
    setIcon(delBtn, 'trash');
    delBtn.addEventListener('click', () => {
      void (async () => {
        if (!window.confirm(t('Delete item from Zotero confirm'))) return;
        const r = await this.plugin.zoteroSync.deleteLibraryItem(stored.key);
        if (r.ok) {
          new Notice(t('Item deleted'));
          await afterSave();
        } else if (r.error === '412') {
          new Notice(
            t(
              'Library changed on the server — use “Sync” or “Use server copy”'
            )
          );
        } else {
          new Notice(t('Save failed') + (r.error ? `: ${r.error}` : ''));
        }
      })();
    });

    if (stored?.conflict) {
      const takeRemote = actions.createEl('button', {
        text: t('Use server copy'),
      });
      takeRemote.addClass('mod-warning');
      takeRemote.addEventListener('click', async () => {
        const ok = await this.plugin.zoteroSync.fetchAndOverwriteItem(
          stored.key
        );
        new Notice(ok ? t('Updated from server') : t('Could not fetch item'));
        if (ok) {
          await this.refreshList();
          await this.plugin.bibManager.loadGlobalZoteroApi();
          this.plugin.bibManager.fileCache.clear();
          this.plugin.processReferences();
        }
      });
    }

    if (citekey) {
      const insertBtn = actions.createEl('button', {
        cls: 'clickable-icon',
        attr: {
          type: 'button',
          'aria-label': t('Insert citekey'),
          title: t('Insert citekey'),
        },
      });
      setIcon(insertBtn, 'quote-glyph');
      insertBtn.addEventListener('click', () => {
        if (
          insertTextInActiveMarkdownNote(
            this.plugin.app,
            `[@${citekey}]`
          )
        ) {
          return;
        }
        new Notice(t('Open a markdown note to insert citations'));
      });
    }
  }
}

class ZoteroNoteEditModal extends Modal {
  constructor(
    private plugin: ReferenceList,
    private item: StoredZoteroItem,
    private onSaved: () => Promise<void>
  ) {
    super(plugin.app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('pwc-zotero-edit-modal');
    this.contentEl.closest('.modal')?.addClass('pwc-zotero-item-modal-shell');

    this.titleEl.setText(t('Edit note'));

    contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: t('Note HTML hint'),
    });

    const ta = contentEl.createEl('textarea', {
      cls: 'pwc-zotero-edit-textarea',
      text: String(this.item.data.note ?? ''),
    });
    ta.rows = 18;
    ta.style.width = '100%';
    ta.style.minHeight = '280px';

    new Setting(contentEl).addButton((b) =>
      b
        .setButtonText(t('Save'))
        .setCta()
        .onClick(async () => {
          const r = await this.plugin.zoteroSync.saveItemEdits(this.item.key, {
            note: ta.value,
          });
          if (r.ok) {
            new Notice(t('Saved'));
            this.close();
            await this.onSaved();
          } else if (r.error === '412') {
            new Notice(
              t(
                'Library changed on the server — use “Sync” or “Use server copy”'
              )
            );
          } else {
            new Notice(t('Save failed') + (r.error ? `: ${r.error}` : ''));
          }
        })
    );

    new Setting(contentEl).addButton((b) =>
      b.setButtonText(t('Cancel')).onClick(() => this.close())
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}

class ZoteroItemEditModal extends Modal {
  constructor(
    private plugin: ReferenceList,
    private item: StoredZoteroItem,
    private onSaved: () => Promise<void>
  ) {
    super(plugin.app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('pwc-zotero-edit-modal');
    contentEl.style.maxHeight = 'min(85vh, 900px)';
    contentEl.style.overflowY = 'auto';
    contentEl.style.width = '100%';
    this.contentEl.closest('.modal')?.addClass('pwc-zotero-item-modal-shell');

    this.titleEl.setText(t('Edit reference'));

    const data = this.item.data;
    const itemType = String(data.itemType ?? '');

    contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: `${t('Item type')}: ${itemType}`,
    });

    contentEl.createEl('p', {
      cls: 'setting-item-description',
      text: t('Edit item form hint'),
    });

    const textField = (label: string, key: string, multiline = false) => {
      const wrap = contentEl.createDiv({ cls: 'pwc-zotero-field' });
      wrap.createEl('label', { text: label });
      const raw = data[key];
      const initial =
        raw == null || raw === undefined
          ? ''
          : typeof raw === 'object'
            ? JSON.stringify(raw)
            : String(raw);
      let input: HTMLInputElement | HTMLTextAreaElement;
      if (multiline) {
        input = wrap.createEl('textarea', {
          cls: 'pwc-zotero-edit-textarea',
          text: initial,
        });
      } else {
        input = wrap.createEl('input', {
          type: 'text',
          cls: 'pwc-zotero-edit-input',
          value: initial,
        });
      }
      return input;
    };

    const citeKeyIn = textField(t('Citation key (Better BibTeX)'), 'citationKey');
    citeKeyIn.value = resolveCitationKey(
      data as Record<string, unknown>,
      this.item.key
    );
    const titleIn = textField(t('Title'), 'title');
    const dateIn = textField(t('Date'), 'date');

    const creatorsHost = contentEl.createDiv({
      cls: 'pwc-zotero-field pwc-zotero-field--creators',
    });
    const creatorsMount = mountZoteroCreatorsEditor(
      creatorsHost,
      data.creators,
      t as (k: string) => string
    );

    const usePublisher = ITEM_TYPES_WITH_PUBLISHER.has(itemType);
    const pubInitial = usePublisher
      ? String(
          (data.publisher as string) ??
            (data.publicationTitle as string) ??
            ''
        )
      : String(
          (data.publicationTitle as string) ?? (data.publisher as string) ?? ''
        );
    const pubIn = textField(
      usePublisher ? t('Publisher') : t('Publication / journal'),
      usePublisher ? 'publisher' : 'publicationTitle'
    );
    pubIn.value = pubInitial;
    const doiIn = textField('DOI', 'DOI');
    const urlIn = textField(t('URL'), 'url');

    const langWrap = contentEl.createDiv({ cls: 'pwc-zotero-field' });
    langWrap.createEl('label', { text: t('Language') });
    const langSel = langWrap.createEl('select', {
      cls: 'pwc-zotero-edit-input pwc-zotero-lang-select',
    });
    langSel.createEl('option', { value: '', text: t('Language optional placeholder') });
    for (const lo of langListRaw) {
      langSel.createEl('option', {
        value: lo.value,
        text: `${lo.label} (${lo.value})`,
      });
    }
    const curLang = typeof data.language === 'string' ? data.language.trim() : '';
    langSel.value = matchStoredLanguageToCslLocale(curLang, langListRaw);

    const extraFieldInputs = new Map<
      string,
      HTMLInputElement | HTMLTextAreaElement
    >();
    for (const def of getZoteroExtraEditableFields(itemType)) {
      const inp = textField(t(def.labelKey), def.key, !!def.multiline);
      extraFieldInputs.set(def.key, inp);
    }

    const absIn = textField(t('Abstract'), 'abstractNote', true);
    const extraIn = textField(t('Extra'), 'extra', true);
    extraIn.value = stripCitationKeyLinesFromExtra(data.extra);

    if (itemType !== 'attachment' && itemType !== 'note') {
      this.mountAttachmentsSection(contentEl, this.item);
    }

    new Setting(contentEl).addButton((b) =>
      b
        .setButtonText(t('Save'))
        .setCta()
        .onClick(async () => {
          const ck = citeKeyIn.value.trim();
          const extraMerged = stripCitationKeyLinesFromExtra(extraIn.value);
          const pubVal = pubIn.value.trim();
          const patch: Record<string, unknown> = {
            title: titleIn.value,
            date: dateIn.value || undefined,
            DOI: doiIn.value || undefined,
            url: urlIn.value || undefined,
            extra: extraMerged || undefined,
            abstractNote: absIn.value || undefined,
            citationKey: ck || undefined,
          };
          if (usePublisher) {
            patch.publisher = pubVal || undefined;
          } else {
            patch.publicationTitle = pubVal || undefined;
          }

          patch.language = langSel.value.trim() || undefined;

          for (const def of getZoteroExtraEditableFields(itemType)) {
            const inp = extraFieldInputs.get(def.key);
            if (!inp) continue;
            const v = inp.value.trim();
            if (v) patch[def.key] = v;
          }

          patch.creators = creatorsMount.getCreators();

          const r = await this.plugin.zoteroSync.saveItemEdits(
            this.item.key,
            patch
          );
          if (r.ok) {
            new Notice(t('Saved'));
            this.close();
            await this.onSaved();
          } else if (r.error === '412') {
            new Notice(
              t(
                'Library changed on the server — use “Sync” or “Use server copy”'
              )
            );
          } else {
            new Notice(t('Save failed') + (r.error ? `: ${r.error}` : ''));
          }
        })
    );

    new Setting(contentEl).addButton((b) =>
      b.setButtonText(t('Cancel')).onClick(() => this.close())
    );
  }

  /**
   * Pièces jointes enfants : liens web et fichiers liés (chemins absolus ou relatifs au coffre).
   */
  private mountAttachmentsSection(
    contentEl: HTMLElement,
    parentItem: StoredZoteroItem
  ): void {
    const resolveLinkedPath = (input: string): string =>
      resolveVaultPdfAbsolutePath(input);

    const wrap = contentEl.createDiv({ cls: 'pwc-zotero-attachments' });
    wrap.createEl('div', {
      cls: 'setting-item-heading',
      text: t('Attachments'),
    });

    const listHost = wrap.createDiv({ cls: 'pwc-zotero-attachments-list' });

    const notify412 = () =>
      new Notice(
        t(
          'Library changed on the server — use “Sync” or “Use server copy”'
        )
      );

    const refreshList = async () => {
      listHost.empty();
      const snap = await this.plugin.zoteroSync.loadSnapshot();
      const children = Object.values(snap.items).filter(
        (st) =>
          String(st.data.parentItem) === parentItem.key &&
          String(st.data.itemType) === 'attachment' &&
          Number(st.data.deleted) !== 1
      );
      children.sort((a, b) =>
        rowTitle(a).localeCompare(rowTitle(b), undefined, {
          sensitivity: 'base',
        })
      );

      for (const att of children) {
        const row = listHost.createDiv({
          cls: 'pwc-zotero-attachment-row',
        });
        const d = att.data as Record<string, unknown>;
        const lm = String(d.linkMode ?? '');
        const isLinkedUrl = lm === 'linked_url';
        const isLinkedFile = lm === 'linked_file';

        let modeLabel = '';
        if (isLinkedUrl) modeLabel = t('Web link');
        else if (isLinkedFile) modeLabel = t('Local file');
        else modeLabel = lm || 'attachment';

        row.createEl('div', {
          cls: 'setting-item-name',
          text: modeLabel,
        });

        const titleRow = row.createDiv({ cls: 'pwc-zotero-field' });
        titleRow.createEl('label', { text: t('Title') });
        const titleIn = titleRow.createEl('input', {
          type: 'text',
          cls: 'pwc-zotero-edit-input',
          value: String(d.title ?? ''),
        });

        let linkIn: HTMLInputElement | undefined;
        if (isLinkedUrl) {
          const urlRow = row.createDiv({ cls: 'pwc-zotero-field' });
          urlRow.createEl('label', { text: t('URL') });
          linkIn = urlRow.createEl('input', {
            type: 'text',
            cls: 'pwc-zotero-edit-input',
            value: String(d.url ?? ''),
          });
        } else if (isLinkedFile) {
          const pathRow = row.createDiv({ cls: 'pwc-zotero-field' });
          pathRow.createEl('label', {
            text: t('Absolute path or vault-relative'),
          });
          linkIn = pathRow.createEl('input', {
            type: 'text',
            cls: 'pwc-zotero-edit-input',
            value: String(d.path ?? ''),
          });
        } else {
          row.createEl('p', {
            cls: 'setting-item-description',
            text: t('Attachment type read-only hint'),
          });
        }

        const btnRow = row.createDiv({
          cls: 'pwc-zotero-attachment-actions',
        });

        const saveRow = async (patch: Record<string, unknown>) => {
          const r = await this.plugin.zoteroSync.saveItemEdits(att.key, patch);
          if (r.ok) {
            new Notice(t('Saved'));
            await refreshList();
            await this.onSaved();
          } else if (r.error === '412') notify412();
          else {
            new Notice(t('Save failed') + (r.error ? `: ${r.error}` : ''));
          }
        };

        if (!isLinkedUrl && !isLinkedFile) {
          btnRow
            .createEl('button', { text: t('Save'), cls: 'mod-cta' })
            .addEventListener('click', () => {
              void saveRow({
                title: titleIn.value.trim() || undefined,
              });
            });
        } else {
          btnRow
            .createEl('button', { text: t('Save link'), cls: 'mod-cta' })
            .addEventListener('click', () => {
              const patch: Record<string, unknown> = {
                title: titleIn.value.trim() || undefined,
              };
              if (isLinkedUrl && linkIn) patch.url = linkIn.value.trim();
              else if (isLinkedFile && linkIn)
                patch.path = resolveLinkedPath(linkIn.value);
              void saveRow(patch);
            });
        }

        btnRow
          .createEl('button', { text: t('Remove') })
          .addEventListener('click', () => {
            if (!window.confirm(t('Delete attachment confirm'))) return;
            void (async () => {
              const r = await this.plugin.zoteroSync.deleteLibraryItem(att.key);
              if (r.ok) {
                new Notice(t('Attachment removed'));
                await refreshList();
                await this.onSaved();
              } else if (r.error === '412') notify412();
              else {
                new Notice(
                  t('Save failed') + (r.error ? `: ${r.error}` : '')
                );
              }
            })();
          });
      }
    };

    const addWeb = wrap.createDiv({ cls: 'pwc-zotero-attachments-add' });
    addWeb.createEl('div', {
      cls: 'setting-item-name',
      text: t('New web link'),
    });
    const urlTitleIn = addWeb.createEl('input', {
      type: 'text',
      cls: 'pwc-zotero-edit-input',
      attr: { placeholder: t('Optional attachment title') },
    });
    const urlIn = addWeb.createEl('input', {
      type: 'text',
      cls: 'pwc-zotero-edit-input',
      attr: { placeholder: t('URL') },
    });
    const webBtns = addWeb.createDiv({
      cls: 'pwc-zotero-attachment-actions',
    });
    webBtns
      .createEl('button', { text: t('Add'), cls: 'mod-cta' })
      .addEventListener('click', () => {
        void (async () => {
          const r = await this.plugin.zoteroSync.createChildAttachment(
            parentItem.key,
            {
              linkMode: 'linked_url',
              title: urlTitleIn.value.trim() || t('Web link'),
              url: urlIn.value.trim(),
            }
          );
          if (r.ok) {
            new Notice(t('Saved'));
            urlTitleIn.value = '';
            urlIn.value = '';
            await refreshList();
            await this.onSaved();
          } else if (r.error === '412') notify412();
          else if (r.error === 'url_required')
            new Notice(t('URL'));
          else {
            new Notice(
              t('Save failed') +
                (r.error ? `: ${formatZoteroWriteError(r.error)}` : '')
            );
          }
        })();
      });

    const addFile = wrap.createDiv({ cls: 'pwc-zotero-attachments-add' });
    addFile.createEl('div', {
      cls: 'setting-item-name',
      text: t('New linked file'),
    });
    const fileTitleIn = addFile.createEl('input', {
      type: 'text',
      cls: 'pwc-zotero-edit-input',
      attr: { placeholder: t('Optional attachment title') },
    });
    const pathFlex = addFile.createDiv({
      cls: 'pwc-zotero-field pwc-zotero-field--path-row',
    });
    pathFlex.createEl('label', {
      text: t('Absolute path or vault-relative'),
    });
    const pathInner = pathFlex.createDiv({
      cls: 'pwc-zotero-path-with-folder',
    });
    const filePathIn = pathInner.createEl('input', {
      type: 'text',
      cls: 'pwc-zotero-edit-input',
      attr: { placeholder: t('Absolute path or vault-relative') },
    });
    const browseBtn = pathInner.createEl('button', {
      cls: 'clickable-icon',
      attr: {
        'aria-label': t('Select file on computer'),
        type: 'button',
      },
    });
    setIcon(browseBtn, 'folder');
    browseBtn.addEventListener('click', () => {
      if (!isDesktop) {
        new Notice(
          t(
            'File selection is only available on desktop. Please enter the path manually.'
          )
        );
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const picked = require('electron').remote.dialog.showOpenDialogSync({
        defaultPath: getVaultRoot() || undefined,
        properties: ['openFile'],
      });
      if (picked?.length) filePathIn.value = picked[0];
    });
    const fileBtns = addFile.createDiv({
      cls: 'pwc-zotero-attachment-actions',
    });
    fileBtns
      .createEl('button', { text: t('Add'), cls: 'mod-cta' })
      .addEventListener('click', () => {
        void (async () => {
          if (!filePathIn.value.trim()) {
            new Notice(t('File path required'));
            return;
          }
          const resolvedPath = resolveLinkedPath(filePathIn.value);
          const r = await this.plugin.zoteroSync.createChildAttachment(
            parentItem.key,
            {
              linkMode: 'linked_file',
              title: fileTitleIn.value.trim() || t('Local file'),
              path: resolvedPath,
            }
          );
          if (r.ok) {
            new Notice(t('Saved'));
            fileTitleIn.value = '';
            filePathIn.value = '';
            await refreshList();
            await this.onSaved();
          } else if (r.error === '412') notify412();
          else {
            new Notice(
              t('Save failed') +
                (r.error ? `: ${formatZoteroWriteError(r.error)}` : '')
            );
          }
        })();
      });

    void refreshList();
  }

  onClose() {
    this.contentEl.empty();
  }
}
