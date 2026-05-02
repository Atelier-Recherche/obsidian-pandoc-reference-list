import {
  ItemView,
  Modal,
  Notice,
  Platform,
  Setting,
  WorkspaceLeaf,
  setIcon,
} from 'obsidian';
import Fuse from 'fuse.js';
import { langListRaw } from './bib/cslLangList';
import { matchStoredLanguageToCslLocale } from './bib/zoteroLangNormalize';
import ReferenceList from './main';
import { insertTextInActiveMarkdownNote } from './helpers';
import { t } from './lang/helpers';
import {
  resolveCitationKey,
  stripCitationKeyLinesFromExtra,
} from './zoteroApi/zoteroToCsl';
import { resolveAttachmentLinks } from './zoteroApi/attachmentLinks';
import { mountZoteroCreatorsEditor } from './zoteroApi/zoteroCreatorsEditor';
import { getZoteroExtraEditableFields } from './zoteroApi/zoteroItemExtraFields';
import type { StoredZoteroItem } from './zoteroApi/types';

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

const fuseOpts = {
  keys: [
    { name: 'title', weight: 0.45 },
    { name: 'citekey', weight: 0.45 },
    { name: 'key', weight: 0.1 },
  ],
  threshold: 0.38,
  minMatchCharLength: 1,
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

function rowKindLabel(st: StoredZoteroItem): string {
  const it = String(st.data.itemType ?? '');
  if (it === 'attachment') return 'PDF / fichier';
  if (it === 'note') return 'Note';
  if (it === 'annotation') return 'Annotation';
  return it || 'item';
}

export class ZoteroLibraryView extends ItemView {
  plugin: ReferenceList;
  private rootEl: HTMLElement;
  private listEl: HTMLElement;
  private filterInput: HTMLInputElement;
  private fuse: Fuse<RowFlat> | null = null;
  private flatRows: RowFlat[] = [];
  private treeRoots: ItemTreeNode[] = [];
  /** Pièces jointes par clé parent (vue liste / recherche plate) */
  private attachmentChildrenByParent = new Map<string, StoredZoteroItem[]>();

  constructor(leaf: WorkspaceLeaf, plugin: ReferenceList) {
    super(leaf);
    this.plugin = plugin;
    this.contentEl.addClass('pwc-zotero-library');
    this.rootEl = this.contentEl.createDiv({
      cls: 'pwc-zotero-library__inner',
    });
    this.rootEl.createEl('h4', {
      cls: 'pwc-zotero-library__heading',
      text: t('Zotero library'),
    });
    const searchWrap = this.rootEl.createDiv({
      cls: 'pwc-zotero-library__search',
    });
    this.filterInput = searchWrap.createEl('input', {
      type: 'search',
      cls: 'pwc-zotero-library__filter',
      attr: { placeholder: t('Filter references…') },
    });
    let debounceTimer = 0;
    this.filterInput.addEventListener('input', () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => this.render(), 120);
    });

    const btnRow = this.rootEl.createDiv({
      cls: 'pwc-zotero-library__toolbar',
    });
    const syncBtn = btnRow.createEl('button', {
      text: t('Sync now'),
      cls: 'mod-cta',
    });
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

    const bibBtn = btnRow.createEl('button', {
      text: t('Export .bib'),
    });
    bibBtn.addClass('mod-cta');
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

  getViewType() {
    return zoteroLibraryViewType;
  }

  getDisplayText() {
    return t('Zotero library');
  }

  getIcon() {
    return 'library';
  }

  async onOpen() {
    await this.refreshList();
  }

  private makeRow(st: StoredZoteroItem): RowFlat {
    const d = st.data as Record<string, unknown>;
    return {
      key: st.key,
      stored: st,
      title: rowTitle(st),
      citekey: resolveCitationKey(d, st.key),
    };
  }

  async refreshList() {
    const snap = await this.plugin.zoteroSync.loadSnapshot();
    const settings = this.plugin.settings;

    this.flatRows = Object.values(snap.items).map((st) => this.makeRow(st));
    this.fuse = new Fuse(this.flatRows, fuseOpts);

    const trashedItems: StoredZoteroItem[] = [];
    const active: StoredZoteroItem[] = [];
    for (const st of Object.values(snap.items)) {
      if (st.data.deleted === 1) {
        trashedItems.push(st);
      } else {
        active.push(st);
      }
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

    let collNames = new Map<string, string>();
    try {
      collNames = await this.plugin.zoteroSync.fetchCollectionNames();
    } catch {
      //
    }

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

    this.attachmentChildrenByParent.clear();
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

    const buildTreeNode = (st: StoredZoteroItem): ItemTreeNode => {
      const d = st.data as Record<string, unknown>;
      const kidsRaw = (byParent.get(st.key) ?? []).sort(sortSt);
      const inlineAttachments = kidsRaw.filter(
        (k) => String(k.data.itemType) === 'attachment'
      );
      const treeKids = kidsRaw.filter(
        (k) => String(k.data.itemType) !== 'attachment'
      );
      return {
        stored: st,
        citekey: resolveCitationKey(d, st.key),
        title: rowTitle(st),
        labelKind: rowKindLabel(st),
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
        (k) => String(k.data.itemType) !== 'attachment'
      );
      return {
        stored: st,
        citekey: resolveCitationKey(d, st.key),
        title: rowTitle(st),
        labelKind: rowKindLabel(st),
        inlineAttachments,
        children: treeKids.map(buildTrashTreeNode),
      };
    };

    const mapTrashRoots = (arr: StoredZoteroItem[]) =>
      arr.sort(sortSt).map(buildTrashTreeNode);

    this.treeRoots = [];

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
      children: [],
    });
    const libRoot = this.treeRoots[0];

    const collKeysSorted = Array.from(byColl.keys()).sort((a, b) =>
      (collNames.get(a) ?? a).localeCompare(collNames.get(b) ?? b)
    );
    for (const ck of collKeysSorted) {
      const name = collNames.get(ck) ?? ck;
      const arr = byColl.get(ck) ?? [];
      libRoot.children.push({
        stored: {} as StoredZoteroItem,
        citekey: '',
        title: `${t('Collection')}: ${name}`,
        labelKind: 'section',
        inlineAttachments: [],
        children: mapRoots(arr),
      });
    }

    if (uncategorized.length) {
      libRoot.children.push({
        stored: {} as StoredZoteroItem,
        citekey: '',
        title: `${t('Uncategorized')} (${uncategorized.length})`,
        labelKind: 'section',
        inlineAttachments: [],
        children: mapRoots(uncategorized),
      });
    }

    if (looseFiles.length) {
      libRoot.children.push({
        stored: {} as StoredZoteroItem,
        citekey: '',
        title: `${t('Loose attachments / notes')} (${looseFiles.length})`,
        labelKind: 'section',
        inlineAttachments: [],
        children: mapRoots(looseFiles),
      });
    }

    if (trashedItems.length) {
      libRoot.children.push({
        stored: {} as StoredZoteroItem,
        citekey: '',
        title: `${t('Trash')} (${trashedItems.length})`,
        labelKind: 'section',
        inlineAttachments: [],
        children: mapTrashRoots(trashRoots),
      });
    }

    this.render();
  }

  private render() {
    const q = this.filterInput?.value?.trim() ?? '';
    this.listEl.empty();

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

    const wrap = this.listEl.createDiv({
      cls: 'pwc-zotero-library__tree-row',
      attr: { style: `--pwc-tree-depth: ${depth}` },
    });
    const rowEl = wrap.createDiv({ cls: 'pwc-zotero-library__row' });
    if (node.stored?.conflict) rowEl.addClass('is-conflict');

    const meta = rowEl.createDiv({ cls: 'pwc-zotero-library__meta' });
    meta.createDiv({
      cls: 'pwc-zotero-library__badge',
      text: node.labelKind,
    });
    meta.createDiv({ cls: 'pwc-zotero-library__title', text: node.title });
    meta.createDiv({
      cls: 'pwc-zotero-library__citekey',
      text: node.citekey ? `@${node.citekey}` : '',
    });

    const actions = rowEl.createDiv({ cls: 'pwc-zotero-library__actions' });
    this.attachRowActions(actions, node.stored, node.citekey);

    if (node.inlineAttachments?.length) {
      this.renderInlineAttachments(wrap, node.inlineAttachments);
    }

    if (node.children.length) {
      const nest = wrap.createDiv({ cls: 'pwc-zotero-library__tree-nest' });
      const prev = this.listEl;
      this.listEl = nest;
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
      text: rowKindLabel(row.stored),
    });
    meta.createDiv({ cls: 'pwc-zotero-library__title', text: row.title });
    meta.createDiv({
      cls: 'pwc-zotero-library__citekey',
      text: `@${row.citekey}`,
    });
    const actions = rowEl.createDiv({ cls: 'pwc-zotero-library__actions' });
    this.attachRowActions(actions, row.stored, row.citekey);
    const atts = this.attachmentChildrenByParent.get(row.key);
    if (atts?.length) this.renderInlineAttachments(wrap, atts);
  }

  private zoteroSelectUri(itemKey: string): string | null {
    const s = this.plugin.settings;
    const libId =
      s.zoteroApiLibraryType === 'group'
        ? s.zoteroApiGroupId
        : s.zoteroApiUserId;
    if (libId == null) return null;
    return `zotero://select/items/@${libId}_${itemKey}`;
  }

  private attachmentLinkLabel(st: StoredZoteroItem): string {
    const d = st.data;
    const fn =
      (typeof d.filename === 'string' && d.filename.trim()) ||
      (typeof d.title === 'string' && d.title.trim()) ||
      rowTitle(st);
    return fn;
  }

  private openLocalPath(p: string) {
    if (!Platform.isDesktop) {
      new Notice(t('Local file open is only available on desktop'));
      return;
    }
    try {
      const { shell } = require('electron') as {
        shell: { openPath: (path: string) => Promise<string> };
      };
      void shell.openPath(p).then((err: string) => {
        if (err) new Notice(`${t('Could not open file')}: ${err}`);
      });
    } catch {
      new Notice(t('Could not open file'));
    }
  }

  private renderInlineAttachments(
    host: HTMLElement,
    attachments: StoredZoteroItem[]
  ) {
    const row = host.createDiv({ cls: 'pwc-zotero-library__pdf-row' });
    for (const att of attachments) {
      const links = resolveAttachmentLinks(att, this.zoteroSelectUri(att.key));
      const lbl = this.attachmentLinkLabel(att);
      const group = row.createDiv({ cls: 'pwc-zotero-library__pdf-group' });
      group.createSpan({
        cls: 'pwc-zotero-library__pdf-filename',
        text: lbl,
      });
      for (const link of links) {
        if (link.kind === 'zotero') {
          const chip = group.createSpan({
            cls: 'pwc-zotero-library__pdf-chip is-clickable',
            attr: { title: link.href },
          });
          const ic = chip.createSpan({ cls: 'pwc-zotero-library__pdf-chip-icon' });
          setIcon(ic, 'library');
          chip.createSpan({
            cls: 'pwc-zotero-library__pdf-chip-text',
            text: t('Open in Zotero'),
          });
          chip.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(link.href);
          });
        } else if (link.kind === 'local') {
          const chip = group.createSpan({
            cls: 'pwc-zotero-library__pdf-chip pwc-zotero-library__pdf-chip--local is-clickable',
            attr: { title: link.path },
          });
          const ic = chip.createSpan({ cls: 'pwc-zotero-library__pdf-chip-icon' });
          setIcon(ic, 'folder-open');
          chip.createSpan({
            cls: 'pwc-zotero-library__pdf-chip-text',
            text: t('Local file'),
          });
          chip.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openLocalPath(link.path);
          });
        } else {
          const chip = group.createSpan({
            cls: 'pwc-zotero-library__pdf-chip is-clickable',
            attr: { title: link.href },
          });
          const ic = chip.createSpan({ cls: 'pwc-zotero-library__pdf-chip-icon' });
          setIcon(ic, 'globe');
          chip.createSpan({
            cls: 'pwc-zotero-library__pdf-chip-text',
            text: t('Web link'),
          });
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
      cls: 'mod-cta pwc-zotero-library__btn-edit',
    });
    const editIcon = editBtn.createSpan({ cls: 'pwc-zotero-library__btn-edit-icon' });
    setIcon(editIcon, 'pencil');
    editBtn.createSpan({ text: ` ${t('Edit')}`, cls: 'pwc-zotero-library__btn-edit-label' });
    editBtn.addEventListener('click', () => {
      new ZoteroItemEditModal(this.plugin, stored, async () => {
        await this.refreshList();
        await this.plugin.bibManager.loadGlobalZoteroApi();
        this.plugin.bibManager.fileCache.clear();
        this.plugin.processReferences();
      }).open();
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
        text: t('Insert citekey'),
      });
      insertBtn.addClass('clickable-icon');
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

  onClose() {
    this.contentEl.empty();
  }
}
