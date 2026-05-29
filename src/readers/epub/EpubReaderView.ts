import { ItemView, Notice, TFile, WorkspaceLeaf, debounce, setIcon } from 'obsidian';
import { t } from '../../lang/helpers';
import type ReferenceList from '../../main';
import { readerRegistry } from '../readerRegistry';
import type { DocumentAnnotation } from '../../annotations/types';
import { vaultPathFromViewState } from '../documentRouter';
import { readOrCreateSidecarAnnotations, saveEpubSidecar } from './epubSidecar';
import { pushEpubAnnotationToZotero, zoteroAnnotationsForEpubAttachment } from './zoteroEpubAnnotations';

export const epubReaderViewType = 'pwc-epub-reader-view';

interface EpubReaderState {
  path?: string;
  file?: string;
  zoteroAnnotationKey?: string;
}

type FoliateViewEl = HTMLElement & {
  open?: (book: File | string) => Promise<void>;
  init?: (opts?: { showTextStart?: boolean }) => Promise<void>;
  close?: () => void;
  goLeft?: () => Promise<void>;
  goRight?: () => Promise<void>;
  getCFI?: (index: number, range?: Range) => string;
  addAnnotation?: (a: { value: string; color?: string }) => void;
  renderer?: {
    getContents?: () => Array<{ index: number; doc: Document }>;
  };
};

export class EpubReaderView extends ItemView {
  plugin: ReferenceList;
  private file: TFile | null = null;
  private annotations: DocumentAnnotation[] = [];
  private zoteroAttachmentKey: string | undefined;
  private host: HTMLElement;
  private toolbar: HTMLElement;
  private foliateEl: FoliateViewEl | null = null;
  private foliateLoaded = false;
  private saveDebounced: () => void;

  constructor(leaf: WorkspaceLeaf, plugin: ReferenceList) {
    super(leaf);
    this.plugin = plugin;
    this.contentEl.addClass('pwc-epub-reader');
    this.toolbar = this.contentEl.createDiv({ cls: 'pwc-epub-reader__toolbar' });
    this.host = this.contentEl.createDiv({ cls: 'pwc-epub-reader__host' });
    this.saveDebounced = debounce(() => void this.persistSidecar(), 800, true);
    this.buildToolbar();
  }



  getViewType(): string {

    return epubReaderViewType;

  }



  getDisplayText(): string {

    return this.file?.basename ?? t('EPUB reader');

  }



  getIcon(): string {

    return 'book-open';

  }



  async onOpen(): Promise<void> {
    await this.loadFromStateOrActiveFile();
  }



  async setState(state: EpubReaderState, result: unknown): Promise<void> {

    await super.setState(state, result);

    await this.loadFromStateOrActiveFile(state);

  }



  getState(): EpubReaderState {

    return {

      path: this.file?.path,

      file: this.file?.path,

      zoteroAttachmentKey: this.zoteroAttachmentKey,

    };

  }



  private resolveVaultPath(state?: EpubReaderState): string | null {

    return (

      vaultPathFromViewState(state) ??

      vaultPathFromViewState(this.leaf.getViewState().state) ??

      this.app.workspace.getActiveFile()?.path ??

      null

    );

  }



  private async loadFromStateOrActiveFile(state?: EpubReaderState): Promise<void> {

    const path = this.resolveVaultPath(state);

    if (!path) {

      this.host.empty();

      this.host.createDiv({

        cls: 'pane-empty',

        text: t('Open an EPUB file from the vault.'),

      });

      return;

    }

    await this.openFile(path, state);

  }



  private buildToolbar(): void {

    const addBtn = (icon: string, label: string, onClick: () => void) => {

      const b = this.toolbar.createEl('button', {

        cls: 'clickable-icon',

        attr: { 'aria-label': label, title: label, type: 'button' },

      });

      setIcon(b, icon);

      b.addEventListener('click', onClick);

    };

    addBtn('chevron-left', t('Previous page'), () => {
      void this.foliateEl?.goLeft?.();
    });

    addBtn('chevron-right', t('Next page'), () => {
      void this.foliateEl?.goRight?.();
    });

    addBtn('highlighter', t('Highlight selection (in reader)'), () => {

      new Notice(

        t('Select text in the EPUB reader, then release the mouse to save a highlight.')

      );

    });

    addBtn('refresh-ccw', t('Reload EPUB'), () => {

      if (this.file) void this.openFile(this.file.path);

    });

  }



  private async onSelection(text: string, cfi?: string): Promise<void> {

    if (!this.file || !text) return;

    const id = `epub-${Date.now()}`;

    const ann: DocumentAnnotation = {

      id,

      source: 'sidecar',

      text,

      cfi,

      comment: '',

      color: '#ffd400',

      created: new Date().toISOString(),

    };

    this.annotations.push(ann);

    this.saveDebounced();

    if (this.zoteroAttachmentKey) {

      void pushEpubAnnotationToZotero(

        this.plugin,

        this.zoteroAttachmentKey,

        ann

      );

    }

    this.syncRegistry();

    new Notice(t('Highlight saved to sidecar'));

  }



  private async persistSidecar(): Promise<void> {

    if (!this.file) return;

    await saveEpubSidecar(this.file.path, this.annotations);

  }



  private async ensureFoliate(): Promise<void> {
    if (customElements.get('foliate-view')) {
      this.foliateLoaded = true;
      return;
    }
    await import('../../../node_modules/foliate-js/view.js');
    this.foliateLoaded = true;
  }

  private attachSelectionHandlers(): void {
    const view = this.foliateEl;
    if (!view) return;
    const attach = (doc: Document, index: number) => {
      doc.addEventListener('mouseup', () => {
        const sel = doc.getSelection?.();
        const text = sel?.toString().trim();
        if (!text || text.length < 2) return;
        try {
          const range = sel && sel.rangeCount ? sel.getRangeAt(0) : undefined;
          const cfi = range && view.getCFI ? view.getCFI(index, range) : undefined;
          void this.onSelection(text, cfi);
          sel?.removeAllRanges();
        } catch (e) {
          console.error('[PandoCit EPUB] selection', e);
        }
      });
    };
    view.addEventListener('load', () => {
      const contents = view.renderer?.getContents?.() ?? [];
      for (const c of contents) attach(c.doc, c.index);
    });
  }




  private async openFile(

    vaultPath: string,

    state?: EpubReaderState

  ): Promise<void> {

    const f = this.app.vault.getAbstractFileByPath(vaultPath);

    if (!(f instanceof TFile)) {

      new Notice(t('EPUB not found in vault'));

      return;

    }

    this.file = f;

    this.zoteroAttachmentKey = state?.zoteroAnnotationKey;



    try {

      await this.ensureFoliate();
      const bytes = await this.app.vault.readBinary(f);
      const blob = new Blob([bytes], { type: 'application/epub+zip' });
      const fileObj = new File([blob], f.name, { type: blob.type });

      this.annotations = await readOrCreateSidecarAnnotations(f.path);

      await this.mergeZoteroAnnotations();
      this.host.empty();
      const el = document.createElement('foliate-view') as FoliateViewEl;
      el.classList.add('pwc-epub-reader__view');
      this.host.appendChild(el);
      this.foliateEl = el;

      if (typeof el.open !== 'function') {
        throw new Error('foliate-view missing open()');
      }
      await el.open(fileObj);
      if (typeof el.init === 'function') await el.init({ showTextStart: true });

      this.attachSelectionHandlers();

      for (const a of this.annotations) {
        if (a.cfi && el.addAnnotation) {
          el.addAnnotation({ value: a.cfi, color: a.color });
        }
      }

      this.syncRegistry();

    } catch (e) {
      const msg = String((e as { message?: unknown })?.message ?? e ?? '');
      if (!msg.includes('File type not supported')) {
        console.error('[PandoCit EPUB]', e);
      }

      this.host.empty();

      this.host.createDiv({

        cls: 'pane-empty',

        text: t('EPUB reader failed to initialize'),

      });

    }

  }



  private async mergeZoteroAnnotations(): Promise<void> {

    if (!this.plugin.settings.pullFromZoteroApi || !this.file) return;

    const snap = await this.plugin.zoteroSync.loadSnapshot();

    if (!this.zoteroAttachmentKey) {

      for (const st of Object.values(snap.items)) {

        if (String(st.data.itemType) !== 'attachment') continue;

        const d = st.data as Record<string, unknown>;

        const title = String(d.title ?? '');

        if (title && this.file.name.includes(title.slice(0, 20))) {

          this.zoteroAttachmentKey = st.key;

          break;

        }

      }

    }

    if (!this.zoteroAttachmentKey) return;

    const zot = zoteroAnnotationsForEpubAttachment(

      snap,

      this.zoteroAttachmentKey

    );

    const ids = new Set(this.annotations.map((a) => a.id));

    for (const a of zot) {

      if (!ids.has(a.id)) this.annotations.push(a);

    }

  }



  private syncRegistry(): void {

    if (!this.file) return;

    readerRegistry.set({

      kind: 'epub',

      vaultPath: this.file.path,

      annotations: [...this.annotations],

      zoteroAttachmentKey: this.zoteroAttachmentKey,

    });

    this.plugin.emitter.trigger('pwc-document-annotations-changed');

  }



  async onClose(): Promise<void> {
    readerRegistry.set(null);
    this.foliateEl?.close?.();
    this.foliateEl = null;
  }

}

