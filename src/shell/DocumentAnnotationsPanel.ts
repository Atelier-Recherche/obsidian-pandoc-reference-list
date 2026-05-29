import { Notice, setIcon } from 'obsidian';

import {
  copyAnnotationReferenceNotice,
  formatDocumentAnnotationReference,
} from '../annotations/annotationReference';
import { t } from '../lang/helpers';
import type ReferenceList from '../main';
import { readerRegistry } from '../readers/readerRegistry';
import type { DocumentAnnotation } from '../annotations/types';
import { openDocumentFromPlugin } from '../readers/openDocument';
import {
  exportAnnotationsToHypothesis,
  importHypothesisForUri,
  isHypothesisConfigured,
} from '../hypothesis/hypothesisBridge';
import { createPdfHighlightFromSelection } from '../readers/pdf/pdfCreateHighlight';
import {
  convertAnnotationTarget,
  deleteDocumentAnnotation,
} from '../readers/pdf/pdfAnnotationActions';

export class DocumentAnnotationsPanel {
  private listEl: HTMLElement;
  private searchQuery = '';
  private unsub: (() => void) | null = null;

  constructor(
    private host: HTMLElement,
    private plugin: ReferenceList
  ) {
    host.empty();
    host.addClass('pwc-doc-annotations');
    const head = host.createDiv({ cls: 'pwc-doc-annotations__head' });
    const search = head.createEl('input', {
      cls: 'pwc-doc-annotations__search',
      type: 'search',
    });
    search.placeholder = t('Search document annotations');
    search.addEventListener('input', () => {
      this.searchQuery = search.value.trim().toLowerCase();
      this.renderList();
    });

    const actions = head.createDiv({ cls: 'pwc-doc-annotations__actions' });
    const addBtn = (icon: string, label: string, fn: () => void) => {
      const b = actions.createEl('button', {
        cls: 'clickable-icon',
        attr: { type: 'button', 'aria-label': label, title: label },
      });
      setIcon(b, icon);
      b.addEventListener('click', fn);
    };
    addBtn('refresh-ccw', t('Refresh'), () => this.render());
    addBtn('highlighter', t('Highlight selection in PDF'), () =>
      void createPdfHighlightFromSelection(this.plugin, { showModal: true })
    );
    if (isHypothesisConfigured(this.plugin)) {
      addBtn('download', t('Import Hypothesis'), () => void this.importHypothesis());
      addBtn('upload', t('Export to Hypothesis'), () => void this.exportHypothesis());
    }

    this.listEl = host.createDiv({ cls: 'pwc-doc-annotations__list' });
    this.unsub = readerRegistry.subscribe(() => this.render());
    this.plugin.registerEvent(
      this.plugin.emitter.on('pwc-document-annotations-changed', () =>
        this.render()
      )
    );
    this.render();
  }

  destroy(): void {
    this.unsub?.();
  }

  private async importHypothesis(): Promise<void> {
    const state = readerRegistry.get();
    if (!state) {
      new Notice(t('Open a document in PandoCit reader first'));
      return;
    }
    const uri = `vault://${state.vaultPath}`;
    const imported = await importHypothesisForUri(this.plugin, uri);
    if (!imported.length) return;
    const merged = [...state.annotations, ...imported];
    readerRegistry.set({ ...state, annotations: merged });
    this.render();
    new Notice(`${t('Imported')}: ${imported.length}`);
  }

  private async exportHypothesis(): Promise<void> {
    const state = readerRegistry.get();
    if (!state) {
      new Notice(t('Open a document in PandoCit reader first'));
      return;
    }
    const uri = `vault://${state.vaultPath}`;
    const n = await exportAnnotationsToHypothesis(
      this.plugin,
      uri,
      state.annotations
    );
    new Notice(`${t('Exported to Hypothesis')}: ${n}`);
  }

  private matchesSearch(ann: DocumentAnnotation): boolean {
    if (!this.searchQuery) return true;
    const hay = [
      ann.text,
      ann.comment,
      ann.pageLabel,
      ann.cfi,
      ann.id,
      ann.source,
      ann.zoteroKey,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(this.searchQuery);
  }

  render(): void {
    this.renderList();
  }

  private renderList(): void {
    this.listEl.empty();
    const state = readerRegistry.get();
    if (!state) {
      this.listEl.createDiv({
        cls: 'pane-empty',
        text: t('Open a PDF or EPUB to see annotations here.'),
      });
      return;
    }
    this.listEl.createDiv({
      cls: 'pwc-doc-annotations__file',
      text: state.vaultPath,
    });
    if (!state.annotations.length) {
      this.listEl.createDiv({
        cls: 'pane-empty',
        text: t('No annotations for this document yet.'),
      });
      return;
    }

    const filtered = state.annotations.filter((ann) => this.matchesSearch(ann));
    if (!filtered.length) {
      this.listEl.createDiv({
        cls: 'pane-empty',
        text: t('No matching annotations'),
      });
      return;
    }

    for (const ann of filtered) {
      this.renderRow(ann, state.vaultPath);
    }
  }

  private renderRow(ann: DocumentAnnotation, vaultPath: string): void {
    const row = this.listEl.createDiv({ cls: 'pwc-doc-annotations__row' });
    const sourceLabel =
      ann.source === 'zotero'
        ? 'ZOTERO'
        : ann.id.startsWith('pdf-')
          ? 'IN PDF'
          : ann.source === 'local-pdf'
            ? 'PANDOCIT'
            : ann.source.toUpperCase();
    row.createDiv({
      cls: 'pwc-doc-annotations__badge',
      text: sourceLabel,
    });
    const displayText = (ann.text || '')
      .replace(/<[^>]+>/g, '')
      .replace(/\[\[PWC:[^\]]+\]\]|\[PWC:[^\]]+\]\]?/g, '')
      .trim()
      .slice(0, 160);
    const displayComment = (ann.comment || '')
      .replace(/\[\[PWC:[^\]]+\]\]|\[PWC:[^\]]+\]\]?/g, '')
      .trim();
    const text = displayText || displayComment || ann.id;
    row.createDiv({ cls: 'pwc-doc-annotations__text', text });
    if (displayComment && displayComment !== displayText) {
      row.createDiv({
        cls: 'pwc-doc-annotations__text',
        text: `Note: ${displayComment.slice(0, 200)}`,
      });
    }
    if (ann.pageLabel || ann.cfi) {
      row.createDiv({
        cls: 'pwc-doc-annotations__loc',
        text: ann.pageLabel ? `p.${ann.pageLabel}` : ann.cfi?.slice(0, 40),
      });
    }
    const actions = row.createDiv({ cls: 'pwc-doc-annotations__row-actions' });
    const citekey = readerRegistry.get()?.citekey;
    const copyBtn = actions.createEl('button', {
      cls: 'clickable-icon',
      attr: {
        type: 'button',
        'aria-label': t('Copy annotation reference'),
        title: t('Copy annotation reference'),
      },
    });
    setIcon(copyBtn, 'copy');
    copyBtn.addEventListener('click', () => {
      const text = formatDocumentAnnotationReference(ann, vaultPath, citekey);
      void copyAnnotationReferenceNotice(text);
    });
    const go = actions.createEl('button', {
      text: t('Go to'),
      cls: 'mod-cta',
    });
    go.addEventListener('click', () => {
      const page = ann.pageIndex != null ? ann.pageIndex + 1 : undefined;
      void openDocumentFromPlugin(this.plugin, vaultPath, {
        page,
        zoteroAnnotationKey: ann.zoteroKey,
        reuseOpenPdfLeaf: true,
      });
    });
    const del = actions.createEl('button', { text: t('Delete') });
    del.addEventListener('click', () => {
      const ok = window.confirm('Supprimer cette annotation ?');
      if (!ok) return;
      void deleteDocumentAnnotation(this.plugin, vaultPath, ann);
    });
    if (ann.source === 'local-pdf') {
      const toZ = actions.createEl('button', { text: '→ Zotero' });
      toZ.addEventListener('click', () => {
        void convertAnnotationTarget(this.plugin, vaultPath, ann, 'zotero');
      });
    }
    if (ann.source === 'zotero') {
      const toPdf = actions.createEl('button', { text: '→ PDF' });
      toPdf.addEventListener('click', () => {
        void convertAnnotationTarget(this.plugin, vaultPath, ann, 'pdf');
      });
    }
  }
}
