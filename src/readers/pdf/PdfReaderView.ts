import { ItemView, Notice, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import { t } from '../../lang/helpers';
import type ReferenceList from '../../main';
import { readerRegistry } from '../readerRegistry';
import type { DocumentAnnotation } from '../../annotations/types';
import { zoteroAnnotationsForAttachment } from './zoteroPdfAnnotations';
import { configurePdfWorker } from './pdfWorker';
import { pdfGetDocumentInit } from './pdfAssets';
import { vaultPathFromViewState } from '../documentRouter';

export const pdfReaderViewType = 'pwc-pdf-reader-view';

interface PdfReaderState {
  path?: string;
  file?: string;
  page?: number;
  zoteroAnnotationKey?: string;
}

export class PdfReaderView extends ItemView {
  plugin: ReferenceList;
  private file: TFile | null = null;
  private toolbar: HTMLElement;
  private host: HTMLElement;
  private iframe: HTMLIFrameElement | null = null;
  private pdfBlobUrl: string | null = null;
  private pageInfoEl: HTMLElement | null = null;
  private pageInputEl: HTMLInputElement | null = null;
  private zoteroAttachmentKey: string | undefined;
  private currentPage = 1;
  private totalPages = 1;
  private pdfDoc: Awaited<ReturnType<ReturnType<typeof pdfjsLib.getDocument>['promise']['then']>> | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: ReferenceList) {
    super(leaf);
    this.plugin = plugin;
    configurePdfWorker(plugin);
    this.contentEl.addClass('pwc-pdf-reader');
    this.toolbar = this.contentEl.createDiv({ cls: 'pwc-pdf-reader__toolbar' });
    this.host = this.contentEl.createDiv({ cls: 'pwc-pdf-reader__scroll' });
    this.buildToolbar();
  }

  getViewType(): string {
    return pdfReaderViewType;
  }

  getDisplayText(): string {
    return this.file?.basename ?? t('PDF reader');
  }

  getIcon(): string {
    return 'file-text';
  }

  async onOpen(): Promise<void> {
    const statePath = vaultPathFromViewState(this.leaf.getViewState().state);
    if (statePath) return;
    await this.loadFromStateOrActiveFile();
  }

  async setState(state: PdfReaderState, result: unknown): Promise<void> {
    await super.setState(state, result);
    await this.loadFromStateOrActiveFile(state);
  }

  getState(): PdfReaderState {
    return {
      path: this.file?.path,
      page: this.currentPage,
      zoteroAnnotationKey: this.zoteroAttachmentKey,
    };
  }

  private buildToolbar(): void {
    const b = this.toolbar.createEl('button', {
      cls: 'clickable-icon',
      attr: { 'aria-label': t('Reload PDF'), title: t('Reload PDF'), type: 'button' },
    });
    setIcon(b, 'refresh-ccw');
    b.addEventListener('click', () => this.reloadCurrentPdf());
    this.toolbar.createSpan({ text: t('Official PDF.js viewer mode') });
  }

  private resolveVaultPath(state?: PdfReaderState): string | null {
    return (
      vaultPathFromViewState(state) ??
      vaultPathFromViewState(this.leaf.getViewState().state) ??
      this.file?.path ??
      null
    );
  }

  private async loadFromStateOrActiveFile(state?: PdfReaderState): Promise<void> {
    const path = this.resolveVaultPath(state);
    if (!path) {
      this.host.empty();
      this.host.createDiv({
        cls: 'pane-empty',
        text: t('Open a PDF file from the vault.'),
      });
      return;
    }
    await this.openFile(path, state);
  }

  private async openFile(vaultPath: string, state?: PdfReaderState): Promise<void> {
    const f = this.app.vault.getAbstractFileByPath(vaultPath);
    if (!(f instanceof TFile)) {
      new Notice(t('PDF not found in vault'));
      return;
    }
    this.file = f;
    this.zoteroAttachmentKey = state?.zoteroAnnotationKey;
    this.currentPage = Math.max(1, state?.page ?? 1);
    await this.loadAnnotationsForPanel();
    await this.openInOfficialViewer();
  }

  private async openInOfficialViewer(): Promise<void> {
    if (!this.file) return;
    if (this.pdfBlobUrl) {
      URL.revokeObjectURL(this.pdfBlobUrl);
      this.pdfBlobUrl = null;
    }
    this.host.empty();
    this.iframe = this.host.createEl('iframe', { cls: 'pwc-pdf-reader__iframe' });
    // Last 5.7 attempt: avoid Obsidian sandbox edge-cases with srcdoc + parent globals.
    // We intentionally don't set `sandbox` here.
    this.iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
    this.iframe.setAttribute('referrerpolicy', 'no-referrer');

    if (this.pdfDoc) {
      await this.pdfDoc.destroy();
      this.pdfDoc = null;
    }
    try {
      const bytes = await this.app.vault.readBinary(this.file);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      this.pdfBlobUrl = URL.createObjectURL(blob);
      (globalThis as any).pdfjsLib = pdfjsLib;
      await import('pdfjs-dist/legacy/web/pdf_viewer.mjs');
      this.iframe.srcdoc = this.buildInlineViewerSrcdoc(
        this.pdfBlobUrl,
        this.currentPage
      );

      const loading = pdfjsLib.getDocument(pdfGetDocumentInit(this.plugin, bytes));
      const doc = await loading.promise;
      this.pdfDoc = doc;
      this.totalPages = doc.numPages;
      this.updatePageUi();
    } catch (e) {
      console.error('[PandoCit PDF]', e);
      new Notice(t('Failed to open PDF — see console'));
    }
  }

  private buildInlineViewerSrcdoc(fileUrl: string, initialPage: number): string {
    const safeFileUrl = JSON.stringify(fileUrl);
    const safePage = Number.isFinite(initialPage) ? Math.max(1, Math.floor(initialPage)) : 1;
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body { margin: 0; height: 100%; overflow: hidden; }
    #app { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    #toolbar { display: flex; gap: 8px; align-items: center; padding: 6px 8px; border-bottom: 1px solid #8883; font-family: sans-serif; }
    #viewerHost { flex: 1; min-height: 0; position: relative; }
    #viewerContainer { position: absolute; inset: 0; overflow: auto; }
    #viewer { position: relative; }
    input[type="number"] { width: 80px; }
  </style>
</head>
<body>
  <div id="app">
    <div id="toolbar">
      <button id="prev">Prev</button>
      <button id="next">Next</button>
      <span id="pageInfo">1 / 1</span>
      <input id="pageInput" type="number" min="1" step="1" value="1" />
      <button id="go">Go</button>
      <button id="zoomOut">-</button>
      <button id="zoomIn">+</button>
      <button id="fitWidth">Fit width</button>
      <button id="fitPage">Fit page</button>
    </div>
    <div id="viewerHost">
      <div id="viewerContainer"><div id="viewer" class="pdfViewer"></div></div>
    </div>
  </div>
  <script>
    (async () => {
      const p = window.parent;
      const pdfjsLib = p.pdfjsLib;
      const pdfjsViewer = p.pdfjsViewer;
      if (!pdfjsLib || !pdfjsViewer) {
        throw new Error('Missing parent pdfjs globals');
      }
      const { EventBus, PDFLinkService, PDFViewer } = pdfjsViewer;
      const eventBus = new EventBus();
      const linkService = new PDFLinkService({ eventBus });
      const viewerContainer = document.getElementById('viewerContainer');
      const viewer = document.getElementById('viewer');
      const pageInfo = document.getElementById('pageInfo');
      const pageInput = document.getElementById('pageInput');
      const pdfViewer = new PDFViewer({
        container: viewerContainer,
        viewer,
        eventBus,
        linkService,
        textLayerMode: 1,
        annotationMode: 2,
      });
      linkService.setViewer(pdfViewer);
      const loadingTask = pdfjsLib.getDocument({ url: ${safeFileUrl} });
      const pdfDoc = await loadingTask.promise;
      pdfViewer.setDocument(pdfDoc);
      linkService.setDocument(pdfDoc, null);
      await pdfViewer.firstPagePromise;
      if (pdfViewer.pagesPromise) await pdfViewer.pagesPromise;
      const initialPage = Math.max(1, Math.min(pdfDoc.numPages, ${safePage}));
      pdfViewer.currentPageNumber = initialPage;
      pageInput.value = String(initialPage);
      pageInfo.textContent = initialPage + ' / ' + pdfDoc.numPages;
      eventBus.on('pagechanging', ({ pageNumber }) => {
        pageInput.value = String(pageNumber);
        pageInfo.textContent = pageNumber + ' / ' + pdfDoc.numPages;
      });
      document.getElementById('prev').addEventListener('click', () => {
        pdfViewer.currentPageNumber = Math.max(1, pdfViewer.currentPageNumber - 1);
      });
      document.getElementById('next').addEventListener('click', () => {
        pdfViewer.currentPageNumber = Math.min(pdfDoc.numPages, pdfViewer.currentPageNumber + 1);
      });
      document.getElementById('go').addEventListener('click', () => {
        const p = Number(pageInput.value || '1');
        if (!Number.isFinite(p)) return;
        pdfViewer.currentPageNumber = Math.max(1, Math.min(pdfDoc.numPages, p));
      });
      pageInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') document.getElementById('go').click();
      });
      document.getElementById('zoomIn').addEventListener('click', () => {
        pdfViewer.currentScale = Math.min(10, (Number(pdfViewer.currentScale) || 1) * 1.15);
      });
      document.getElementById('zoomOut').addEventListener('click', () => {
        pdfViewer.currentScale = Math.max(0.1, (Number(pdfViewer.currentScale) || 1) / 1.15);
      });
      document.getElementById('fitWidth').addEventListener('click', () => {
        pdfViewer.currentScaleValue = 'page-width';
      });
      document.getElementById('fitPage').addEventListener('click', () => {
        pdfViewer.currentScaleValue = 'page-fit';
      });
    })().catch((e) => {
      console.error('[PandoCit PDF inline viewer]', e);
      document.body.innerHTML = '<pre style="padding:12px;color:#c00">PDF viewer failed: ' + (e?.message || e) + '</pre>';
    });
  </script>
</body>
</html>`;
  }

  private async loadAnnotationsForPanel(): Promise<void> {
    if (!this.file) return;
    const annotations: DocumentAnnotation[] = [];
    if (this.plugin.settings.pullFromZoteroApi) {
      const snap = await this.plugin.zoteroSync.loadSnapshot();
      if (!this.zoteroAttachmentKey) {
        for (const st of Object.values(snap.items)) {
          if (String(st.data.itemType) !== 'attachment') continue;
          const d = st.data as Record<string, unknown>;
          const p = String(d.path ?? d.url ?? '');
          if (
            p &&
            this.file.path.endsWith(
              p.replace(/\\/g, '/').split('/').pop() ?? '___'
            )
          ) {
            this.zoteroAttachmentKey = st.key;
            break;
          }
        }
      }
      if (this.zoteroAttachmentKey) {
        annotations.push(
          ...zoteroAnnotationsForAttachment(snap, this.zoteroAttachmentKey)
        );
      }
    }
    readerRegistry.set({
      kind: 'pdf',
      vaultPath: this.file.path,
      annotations,
      zoteroAttachmentKey: this.zoteroAttachmentKey,
    });
    this.plugin.emitter.trigger('pwc-document-annotations-changed');
  }

  private reloadCurrentPdf(): void {
    void this.openInOfficialViewer();
  }

  private updatePageUi(): void {
    const total = this.totalPages || 1;
    const page = this.currentPage || 1;
    if (this.pageInfoEl) this.pageInfoEl.setText(`${page} / ${total}`);
    if (this.pageInputEl) {
      this.pageInputEl.max = String(total);
      this.pageInputEl.value = String(page);
    }
  }

  async onClose(): Promise<void> {
    readerRegistry.set(null);
    if (this.pdfDoc) {
      await this.pdfDoc.destroy();
      this.pdfDoc = null;
    }
    if (this.pdfBlobUrl) {
      URL.revokeObjectURL(this.pdfBlobUrl);
      this.pdfBlobUrl = null;
    }
    this.iframe = null;
  }
}
