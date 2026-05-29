import { TFile, type WorkspaceLeaf } from 'obsidian';

import type ReferenceList from '../main';
import { pdfReaderViewType } from './pdf/PdfReaderView';
import { epubReaderViewType } from './epub/EpubReaderView';
import { resolveDocumentOpenMode } from './openDocument';
import { refreshPdfPanelAnnotations } from './pdf/pdfPanelAnnotations';
import { registerPdfNativeViewerUi } from './pdf/pdfNativeViewerUi';
import { scheduleZoteroOverlayRender } from './pdf/zoteroPdfOverlay';

export type DocumentKind = 'pdf' | 'epub';

export function documentKindForFile(file: TFile): DocumentKind | null {
  const ext = file.extension.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'epub') return 'epub';
  return null;
}

/** Obsidian peut passer `path` ou `file` dans le state de la vue. */
export function vaultPathFromViewState(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const s = state as Record<string, unknown>;
  if (typeof s.path === 'string' && s.path.trim()) return s.path.trim();
  if (typeof s.file === 'string' && s.file.trim()) return s.file.trim();
  return null;
}

export function shouldUsePandocitReader(
  plugin: ReferenceList,
  kind: DocumentKind
): boolean {
  if (kind === 'pdf') return false;
  return resolveDocumentOpenMode(plugin, kind) === 'pandocit';
}

/**
 * Remplace le lecteur natif (PDF) ou assure la vue PandoCit après ouverture du fichier.
 */
export async function openInPandocitReader(
  plugin: ReferenceList,
  file: TFile,
  opts?: { page?: number; leaf?: WorkspaceLeaf | null }
): Promise<void> {
  const kind = documentKindForFile(file);
  if (!kind) return;

  const viewType = kind === 'pdf' ? pdfReaderViewType : epubReaderViewType;
  let leaf = opts?.leaf ?? plugin.app.workspace.activeLeaf;
  if (!leaf) {
    leaf = plugin.app.workspace.getLeaf('tab');
  }

  plugin.skipFileOpenRoute = true;
  try {
    await leaf.setViewState({
      type: viewType,
      state: {
        path: file.path,
        file: file.path,
        page: opts?.page,
      },
    });
    plugin.app.workspace.revealLeaf(leaf);
  } finally {
    plugin.skipFileOpenRoute = false;
  }
}

export function schedulePandocitReaderSwap(
  plugin: ReferenceList,
  file: TFile
): void {
  const kind = documentKindForFile(file);
  if (!kind || !shouldUsePandocitReader(plugin, kind)) return;

  const run = () => {
    void openInPandocitReader(plugin, file);
  };

  // Obsidian ouvre d'abord le PDF natif : attendre la fin du cycle layout.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(run, 0);
    });
  });
}

export function registerDocumentOpenRouter(plugin: ReferenceList): void {
  registerPdfNativeViewerUi(plugin);

  plugin.registerEvent(
    plugin.app.workspace.on('file-open', (file) => {
      if (plugin.skipFileOpenRoute || !(file instanceof TFile)) return;
      const kind = documentKindForFile(file);
      if (!kind || !shouldUsePandocitReader(plugin, kind)) return;
      schedulePandocitReaderSwap(plugin, file);
    })
  );

  plugin.registerEvent(
    plugin.app.workspace.on('file-open', (file) => {
      if (!(file instanceof TFile)) return;
      if (documentKindForFile(file) !== 'pdf') return;
      void refreshPdfPanelAnnotations(plugin, file).then(() => {
        scheduleZoteroOverlayRender(plugin);
      });
    })
  );

  plugin.registerEvent(
    plugin.app.workspace.on('active-leaf-change', () => {
      scheduleZoteroOverlayRender(plugin);
    })
  );

  plugin.registerEvent(
    plugin.app.workspace.on('active-leaf-change', () => {
      if (plugin.skipFileOpenRoute) return;
      const file = plugin.app.workspace.getActiveFile();
      if (!(file instanceof TFile)) return;
      const kind = documentKindForFile(file);
      if (!kind || !shouldUsePandocitReader(plugin, kind)) return;

      const viewType =
        kind === 'pdf' ? pdfReaderViewType : epubReaderViewType;
      const leaf = plugin.app.workspace.activeLeaf;
      if (!leaf || leaf.view.getViewType() === viewType) return;

      schedulePandocitReaderSwap(plugin, file);
    })
  );
}
