import { Modal, Notice, Setting, TFile } from 'obsidian';

import { t } from '../../lang/helpers';
import type ReferenceList from '../../main';
import type { PdfHighlight, PdfRect } from './pdfAnnotationBridge';
import { embedHighlightsInPdf } from './pdfSave';
import { pushHighlightToZotero } from './zoteroPdfAnnotations';
import {
  refreshPdfPanelAnnotations,
  getCachedPdfPageSizes,
} from './pdfPanelAnnotations';
import { scheduleZoteroOverlayRender } from './zoteroPdfOverlay';
import { findZoteroAttachmentKeyForVaultFile } from './zoteroAttachmentMatch';
import {
  getPdfHighlightPrefs,
  savePdfHighlightPrefs,
  type PdfHighlightPrefs,
  type PdfHighlightStyle,
  type PdfHighlightTarget,
} from './pdfHighlightPrefs';

export type { PdfHighlightPrefs, PdfHighlightStyle, PdfHighlightTarget };

export interface CreatePdfHighlightOptions {
  /** Style/destination mémorisés + commentaire optionnel (modal courte). */
  useSavedPrefs?: boolean;
  /** Tous les réglages modifiables (modal complète). */
  showModal?: boolean;
}

function prefsSummaryLabel(prefs: PdfHighlightPrefs): string {
  const styleKey =
    prefs.style === 'highlight'
      ? 'Highlight style highlight'
      : prefs.style === 'underline'
        ? 'Highlight style underline'
        : prefs.style === 'strikeout'
          ? 'Highlight style strikeout'
          : 'Highlight style squiggly';
  const targetKey =
    prefs.target === 'pdf'
      ? 'Highlight target pdf'
      : prefs.target === 'zotero'
        ? 'Highlight target zotero'
        : 'Highlight target both';
  return `${t(styleKey)} · ${t(targetKey)}`;
}

class PdfCommentModal extends Modal {
  private color: string;
  private commentEl: HTMLTextAreaElement | null = null;
  private opacity: number;
  private style: PdfHighlightStyle;
  private target: PdfHighlightTarget;
  private done = false;
  constructor(
    app: ReferenceList['app'],
    initial: PdfHighlightPrefs,
    private onSubmit: (value: (PdfHighlightPrefs & { comment: string }) | null) => void
  ) {
    super(app);
    this.color = initial.color;
    this.opacity = initial.opacity;
    this.style = initial.style;
    this.target = initial.target;
  }
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('pwc-pdf-comment-modal');

    contentEl.createEl('h3', { text: 'Ajouter une note (optionnel)' });
    new Setting(contentEl)
      .setName('Couleur')
      .addColorPicker((cp) => {
        cp.setValue(this.color).onChange((v) => {
          this.color = v;
        });
      });
    new Setting(contentEl)
      .setName('Transparence')
      .setDesc('0 = opaque, 100 = très transparent')
      .addSlider((sl) => {
        sl.setLimits(10, 90, 5)
          .setValue(Math.round((1 - this.opacity) * 100))
          .setDynamicTooltip()
          .onChange((v) => {
            this.opacity = 1 - v / 100;
          });
      });
    new Setting(contentEl)
      .setName('Style')
      .addDropdown((dd) => {
        dd.addOption('highlight', 'Surlignage')
          .addOption('underline', 'Soulignement')
          .addOption('strikeout', 'Barré')
          .addOption('squiggly', 'Vague');
        dd.setValue(this.style).onChange((v) => {
          this.style = v as PdfHighlightStyle;
        });
      });
    new Setting(contentEl)
      .setName('Cible de sauvegarde')
      .addDropdown((dd) => {
        dd.addOption('both', 'PDF + Zotero')
          .addOption('pdf', 'PDF uniquement')
          .addOption('zotero', 'Zotero uniquement');
        dd.setValue(this.target).onChange((v) => {
          this.target = v as PdfHighlightTarget;
        });
      });
    const ta = contentEl.createEl('textarea', {
      cls: 'pwc-pdf-comment-textarea',
    });
    ta.placeholder = 'Saisir un commentaire';
    ta.rows = 4;
    ta.spellcheck = true;
    ta.addEventListener('keydown', (e) => e.stopPropagation());
    ta.addEventListener('keypress', (e) => e.stopPropagation());
    ta.addEventListener('mousedown', (e) => e.stopPropagation());
    this.commentEl = ta;

    const row = contentEl.createDiv({ cls: 'pwc-open-mode-modal__row' });
    row.createEl('button', { text: 'Enregistrer', cls: 'mod-cta' }).addEventListener(
      'click',
      () => {
        this.done = true;
        this.onSubmit({
          comment: (this.commentEl?.value ?? '').trim(),
          style: this.style,
          target: this.target,
          color: this.color,
          opacity: this.opacity,
        });
        this.close();
      }
    );
    row.createEl('button', { text: 'Annuler' }).addEventListener('click', () => {
      this.close();
    });
    window.setTimeout(() => ta.focus(), 80);
  }
  onClose(): void {
    if (!this.done) {
      this.onSubmit(null);
    }
    this.contentEl.empty();
  }
}

async function askPdfComment(
  plugin: ReferenceList,
  initial: PdfHighlightPrefs
): Promise<(PdfHighlightPrefs & { comment: string }) | null> {
  return new Promise((resolve) => {
    const m = new PdfCommentModal(plugin.app, initial, resolve);
    m.open();
  });
}

/** Modal courte : commentaire optionnel, style et destination inchangés (mémorisés). */
class PdfQuickCommentModal extends Modal {
  private commentEl: HTMLTextAreaElement | null = null;
  private done = false;
  constructor(
    app: ReferenceList['app'],
    private prefs: PdfHighlightPrefs,
    private onSubmit: (value: (PdfHighlightPrefs & { comment: string }) | null) => void
  ) {
    super(app);
  }
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('pwc-pdf-comment-modal');
    contentEl.addClass('pwc-pdf-comment-modal--quick');

    contentEl.createEl('h3', { text: t('Highlight quick modal title') });
    contentEl.createEl('p', {
      cls: 'pwc-pdf-comment-modal__prefs',
      text: prefsSummaryLabel(this.prefs),
    });
    contentEl.createEl('p', {
      cls: 'pwc-pdf-comment-modal__hint',
      text: t('Highlight quick modal hint'),
    });

    const ta = contentEl.createEl('textarea', {
      cls: 'pwc-pdf-comment-textarea',
    });
    ta.placeholder = t('Optional comment placeholder');
    ta.rows = 3;
    ta.spellcheck = true;
    ta.addEventListener('keydown', (e) => e.stopPropagation());
    ta.addEventListener('keypress', (e) => e.stopPropagation());
    ta.addEventListener('mousedown', (e) => e.stopPropagation());
    this.commentEl = ta;

    const row = contentEl.createDiv({ cls: 'pwc-open-mode-modal__row' });
    row.createEl('button', { text: t('Save highlight'), cls: 'mod-cta' }).addEventListener(
      'click',
      () => {
        this.done = true;
        this.onSubmit({
          ...this.prefs,
          comment: (this.commentEl?.value ?? '').trim(),
        });
        this.close();
      }
    );
    row.createEl('button', { text: t('Cancel') }).addEventListener('click', () => {
      this.close();
    });
    window.setTimeout(() => ta.focus(), 80);
  }
  onClose(): void {
    if (!this.done) {
      this.onSubmit(null);
    }
    this.contentEl.empty();
  }
}

async function askPdfQuickComment(
  plugin: ReferenceList,
  prefs: PdfHighlightPrefs
): Promise<(PdfHighlightPrefs & { comment: string }) | null> {
  return new Promise((resolve) => {
    const m = new PdfQuickCommentModal(plugin.app, prefs, resolve);
    m.open();
  });
}

function getPageElForRect(rect: DOMRect): HTMLElement | null {
  const x = rect.left + Math.max(1, rect.width / 2);
  const y = rect.top + Math.max(1, rect.height / 2);
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  return el?.closest('[data-page-number]') as HTMLElement | null;
}

function toPdfHighlightRect(
  rect: DOMRect,
  pageEl: HTMLElement,
  pdfPageWidth: number,
  pdfPageHeight: number
): PdfRect {
  const pageBox = pageEl.getBoundingClientRect();
  const sx = pageBox.width > 0 ? pdfPageWidth / pageBox.width : 1;
  const sy = pageBox.height > 0 ? pdfPageHeight / pageBox.height : 1;
  return {
    x: Math.max(0, (rect.left - pageBox.left) * sx),
    y: Math.max(0, (rect.top - pageBox.top) * sy),
    width: Math.max(0, rect.width * sx),
    height: Math.max(0, rect.height * sy),
  };
}

function isLikelyPageWideArtifact(rect: DOMRect, pageEl: HTMLElement): boolean {
  const pageBox = pageEl.getBoundingClientRect();
  if (pageBox.width <= 0 || pageBox.height <= 0) return false;
  const rw = rect.width / pageBox.width;
  const rh = rect.height / pageBox.height;
  if (rw > 0.9 && rh > 0.08) return true;
  if (rw > 0.98) return true;
  return false;
}

function collectSelectionByPage(
  file: TFile,
  sel: Selection
): Map<number, PdfRect[]> | null {
  const byPage = new Map<number, PdfRect[]>();
  const sizes = getCachedPdfPageSizes(file.path);
  const ranges: Range[] = [];
  for (let i = 0; i < sel.rangeCount; i++) {
    ranges.push(sel.getRangeAt(i).cloneRange());
  }
  for (const range of ranges) {
    for (const r of Array.from(range.getClientRects())) {
      if (r.width < 1 || r.height < 1) continue;
      const pageEl = getPageElForRect(r);
      if (!pageEl) continue;
      if (isLikelyPageWideArtifact(r, pageEl)) continue;
      const pageNum = Number(pageEl.getAttribute('data-page-number') ?? '0');
      if (!Number.isFinite(pageNum) || pageNum < 1) continue;
      const pageIndex = pageNum - 1;
      const pageSize = sizes?.get(pageIndex);
      if (!pageSize) continue;
      const rect = toPdfHighlightRect(r, pageEl, pageSize.width, pageSize.height);
      if (!byPage.has(pageIndex)) byPage.set(pageIndex, []);
      byPage.get(pageIndex)!.push(rect);
    }
  }
  return byPage.size ? byPage : null;
}

async function applyPdfHighlight(
  plugin: ReferenceList,
  file: TFile,
  text: string,
  byPage: Map<number, PdfRect[]>,
  opts: PdfHighlightPrefs & { comment: string }
): Promise<void> {
  const highlights: PdfHighlight[] = [];
  const baseId = `pwc-${Date.now()}`;
  for (const [pageIndex, rects] of byPage) {
    highlights.push({
      id: `${baseId}-${pageIndex}`,
      pageIndex,
      rects,
      text,
      comment: opts.comment,
      style: opts.style,
      color: opts.color,
      opacity: opts.opacity,
      source: 'local-pdf',
    });
  }

  try {
    if (opts.target !== 'zotero') {
      const bytes = await plugin.app.vault.readBinary(file);
      const saved = await embedHighlightsInPdf(new Uint8Array(bytes), highlights);
      await plugin.app.vault.modifyBinary(file, saved);
    }

    const wantsZotero = opts.target !== 'pdf';
    const attachmentKey = wantsZotero
      ? await findZoteroAttachmentKeyForVaultFile(plugin, file)
      : undefined;

    if (wantsZotero && !attachmentKey) {
      new Notice(
        'Pièce jointe Zotero introuvable pour ce PDF. Vérifiez le lien fichier lié ou synchronisez la bibliothèque.'
      );
    } else if (wantsZotero && attachmentKey) {
      const sizes = getCachedPdfPageSizes(file.path);
      let zoteroOk = 0;
      let lastErr: string | undefined;
      for (const h of highlights) {
        const pageSize = sizes?.get(h.pageIndex);
        const res = await pushHighlightToZotero(
          plugin,
          attachmentKey,
          h,
          pageSize?.height
        );
        if (res.ok) zoteroOk++;
        else lastErr = res.error;
      }
      if (zoteroOk > 0) {
        await plugin.zoteroSync.sync();
      }
      if (lastErr && zoteroOk === 0) {
        new Notice(`Échec Zotero : ${lastErr}`);
      } else if (lastErr) {
        new Notice(`Zotero partiel : ${lastErr}`);
      }
    }

    await savePdfHighlightPrefs(plugin, {
      style: opts.style,
      target: opts.target,
      color: opts.color,
      opacity: opts.opacity,
    });

    await refreshPdfPanelAnnotations(plugin, file);
    scheduleZoteroOverlayRender(plugin);
    window.getSelection()?.removeAllRanges();

    if (opts.target === 'zotero') {
      new Notice(
        attachmentKey
          ? 'Annotation enregistrée dans Zotero'
          : 'Annotation Zotero non enregistrée'
      );
    } else if (opts.target === 'pdf') {
      new Notice(t('Highlight saved to PDF'));
    } else {
      new Notice('Annotation enregistrée (PDF et/ou Zotero)');
    }
  } catch (e) {
    console.error('[PandoCit PDF] create highlight', e);
    new Notice(t('Failed to save PDF highlight'));
  }
}

export async function createPdfHighlightFromSelection(
  plugin: ReferenceList,
  options: CreatePdfHighlightOptions = {}
): Promise<void> {
  const file = plugin.app.workspace.getActiveFile();
  if (!(file instanceof TFile) || file.extension.toLowerCase() !== 'pdf') {
    new Notice(t('Open a PDF first'));
    return;
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    new Notice(t('Select text in the PDF first'));
    return;
  }

  const text = sel.toString().trim();
  const byPage = collectSelectionByPage(file, sel);
  if (!byPage) {
    new Notice(t('No PDF text selection detected'));
    return;
  }

  const saved = getPdfHighlightPrefs(plugin);
  let opts: (PdfHighlightPrefs & { comment: string }) | null;

  if (options.useSavedPrefs) {
    opts = await askPdfQuickComment(plugin, saved);
  } else if (options.showModal !== false) {
    opts = await askPdfComment(plugin, saved);
  } else {
    opts = await askPdfQuickComment(plugin, saved);
  }

  if (!opts) return;
  await applyPdfHighlight(plugin, file, text, byPage, opts);
}
