import { Modal, Notice, Platform, TFile } from 'obsidian';

import { t } from '../lang/helpers';
import {
  openPdfAbsolutePathInObsidianOrExternal,
  resolveVaultRelativePdfPath,
} from '../helpers';
import type ReferenceList from '../main';
import type { DocumentOpenMode } from '../settings';
import { openInPandocitReader } from './documentRouter';

export interface OpenDocumentOptions {
  page?: number;
  zoteroAnnotationKey?: string;
  forceMode?: DocumentOpenMode;
  reuseOpenPdfLeaf?: boolean;
}

function extOf(path: string): string {
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

async function askOpenMode(
  plugin: ReferenceList,
  kind: 'pdf' | 'epub'
): Promise<DocumentOpenMode | null> {
  return new Promise((resolve) => {
    const modal = new OpenModeModal(plugin, kind, resolve);
    modal.open();
  });
}

class OpenModeModal extends Modal {
  constructor(
    app: ReferenceList,
    private kind: 'pdf' | 'epub',
    private resolve: (mode: DocumentOpenMode | null) => void
  ) {
    super(app.app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h3', {
      text:
        this.kind === 'pdf'
          ? t('Open PDF with')
          : t('Open EPUB with'),
    });
    const row = contentEl.createDiv({ cls: 'pwc-open-mode-modal__row' });
    const addBtn = (label: string, mode: DocumentOpenMode) => {
      row.createEl('button', { text: label, cls: 'mod-cta' }).addEventListener(
        'click',
        () => {
          this.resolve(mode);
          this.close();
        }
      );
    };
    addBtn('PandoCit', 'pandocit');
    addBtn('Obsidian', 'obsidian');
    contentEl.createEl('button', { text: t('Cancel') }).addEventListener(
      'click',
      () => {
        this.resolve(null);
        this.close();
      }
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export function resolveDocumentOpenMode(
  plugin: ReferenceList,
  kind: 'pdf' | 'epub',
  force?: DocumentOpenMode
): DocumentOpenMode | 'ask' {
  if (kind === 'pdf') return 'obsidian';
  if (force) return force;
  const s = plugin.settings;
  return kind === 'pdf'
    ? s.pdfOpenMode ?? 'obsidian'
    : s.epubOpenMode ?? 'obsidian';
}

function resolveMode(
  plugin: ReferenceList,
  kind: 'pdf' | 'epub',
  force?: DocumentOpenMode
): DocumentOpenMode | 'ask' {
  return resolveDocumentOpenMode(plugin, kind, force);
}

function viewStatePath(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const s = state as Record<string, unknown>;
  if (typeof s.path === 'string' && s.path) return s.path;
  if (typeof s.file === 'string' && s.file) return s.file;
  return null;
}

async function tryOpenPdfInExistingLeaf(
  plugin: ReferenceList,
  relPath: string,
  page?: number
): Promise<boolean> {
  const canonical = plugin.app.vault.getAbstractFileByPath(relPath);
  if (!(canonical instanceof TFile)) return false;
  const leaves = plugin.app.workspace.getLeavesOfType('pdf');
  const target = leaves.find((leaf) => {
    const p = viewStatePath(leaf.getViewState().state);
    return p === canonical.path;
  });
  if (!target) return false;
  plugin.app.workspace.setActiveLeaf(target, { focus: true });
  await target.openFile(canonical);
  if (page && Number.isFinite(page)) {
    try {
      await plugin.app.workspace.openLinkText(
        `${canonical.path}#page=${page}`,
        '',
        false
      );
    } catch {
      // no-op: opening the file in existing leaf is already done.
    }
  }
  return true;
}

export async function openDocumentFromPlugin(
  plugin: ReferenceList,
  pathOrUrl: string,
  opts: OpenDocumentOptions = {}
): Promise<void> {
  const raw = pathOrUrl.trim();
  if (!raw) return;

  const ext = extOf(raw);
  const kind: 'pdf' | 'epub' | null =
    ext === 'pdf' ? 'pdf' : ext === 'epub' ? 'epub' : null;

  if (!kind) {
    new Notice(t('Unsupported document type'));
    return;
  }

  if (kind === 'pdf' && Platform.isMobileApp) {
    const mode = resolveMode(plugin, 'pdf', opts.forceMode);
    if (mode === 'pandocit') {
      new Notice(t('PandoCit PDF reader is desktop-only'));
      openPdfAbsolutePathInObsidianOrExternal(
        raw,
        '',
        opts.page ?? null,
        plugin.settings.openPdfLinksInNewTab !== false ? 'tab' : false
      );
      return;
    }
  }

  let mode = resolveMode(plugin, kind, opts.forceMode);
  if (mode === 'ask') {
    const picked = await askOpenMode(plugin, kind);
    if (!picked) return;
    mode = picked;
  }

  if (mode === 'obsidian') {
    if (kind === 'pdf') {
      const rel = resolveVaultRelativePdfPath(raw) ?? raw.replace(/\\/g, '/');
      if (opts.reuseOpenPdfLeaf) {
        const reused = await tryOpenPdfInExistingLeaf(plugin, rel, opts.page);
        if (reused) return;
      }
      openPdfAbsolutePathInObsidianOrExternal(
        raw,
        '',
        opts.page ?? null,
        opts.reuseOpenPdfLeaf
          ? false
          : plugin.settings.openPdfLinksInNewTab !== false
            ? 'tab'
            : false
      );
    } else {
      const rel = raw.replace(/\\/g, '/');
      const f = plugin.app.vault.getAbstractFileByPath(rel);
      if (f instanceof TFile) {
        await plugin.app.workspace.getLeaf('tab').openFile(f);
      } else {
        new Notice(t('EPUB not found in vault'));
      }
    }
    return;
  }

  const rel =
    kind === 'pdf'
      ? resolveVaultRelativePdfPath(raw) ?? raw.replace(/\\/g, '/')
      : raw.replace(/\\/g, '/').replace(/^\/+/, '');

  const file = plugin.app.vault.getAbstractFileByPath(rel);
  if (!(file instanceof TFile)) {
    new Notice(t('File must be in the vault for PandoCit reader'));
    return;
  }

  await openInPandocitReader(plugin, file, { page: opts.page });
}

export async function openPdfForPlugin(
  plugin: ReferenceList,
  absPath: string,
  sourcePath: string,
  page: number | null | undefined,
  newLeaf: boolean | import('obsidian').PaneType = 'tab'
): Promise<void> {
  const mode = resolveMode(plugin, 'pdf');
  if (mode === 'pandocit') {
    await openDocumentFromPlugin(plugin, absPath, {
      page: page ?? undefined,
      forceMode: 'pandocit',
    });
    return;
  }
  if (mode === 'ask') {
    await openDocumentFromPlugin(plugin, absPath, { page: page ?? undefined });
    return;
  }
  openPdfAbsolutePathInObsidianOrExternal(
    absPath,
    sourcePath,
    page,
    newLeaf
  );
}

export { registerDocumentOpenRouter as registerFileOpenRouter } from './documentRouter';
