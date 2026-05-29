import { Notice, TFile, setIcon } from 'obsidian';

import {
  copyAnnotationReferenceNotice,
  formatDocumentAnnotationReference,
} from '../../annotations/annotationReference';
import { t } from '../../lang/helpers';
import type ReferenceList from '../../main';
import { readerRegistry } from '../readerRegistry';
import { getCachedPdfPageSizes } from './pdfPanelAnnotations';

function clearOverlay(container: HTMLElement): void {
  container
    .querySelectorAll('.pwc-zotero-overlay-layer')
    .forEach((el) => el.remove());
  container
    .querySelectorAll('.pwc-zotero-popup-wrapper')
    .forEach((el) => el.remove());
}

function findActivePdfContainer(plugin: ReferenceList): HTMLElement | null {
  const leaf = plugin.app.workspace.activeLeaf;
  if (!leaf) return null;
  const file = plugin.app.workspace.getActiveFile();
  if (!(file instanceof TFile) || file.extension.toLowerCase() !== 'pdf') {
    return null;
  }
  return (leaf.view as any)?.containerEl ?? null;
}

export function renderZoteroOverlayOnActivePdf(plugin: ReferenceList): void {
  const state = readerRegistry.get();
  const file = plugin.app.workspace.getActiveFile();
  const container = findActivePdfContainer(plugin);
  if (!container) return;

  clearOverlay(container);

  if (!state || !(file instanceof TFile) || state.vaultPath !== file.path) return;
  const pageSizes = getCachedPdfPageSizes(file.path);
  if (!pageSizes?.size) return;

  const zoteroAnns = state.annotations.filter(
    (a) => a.source === 'zotero' && a.pageIndex != null && a.rects?.length
  );
  if (!zoteroAnns.length) return;

  const pages = container.querySelectorAll<HTMLElement>('[data-page-number]');
  pages.forEach((pageEl) => {
    const pageNumber = Number(pageEl.getAttribute('data-page-number') ?? '0');
    if (!Number.isFinite(pageNumber) || pageNumber < 1) return;
    const pageIndex = pageNumber - 1;
    const pageSize = pageSizes.get(pageIndex);
    if (!pageSize || pageSize.width <= 0 || pageSize.height <= 0) return;

    const anns = zoteroAnns.filter((a) => a.pageIndex === pageIndex);
    if (!anns.length) return;

    const layer = pageEl.createDiv({ cls: 'pwc-zotero-overlay-layer' });
    for (const ann of anns) {
      for (const rect of ann.rects ?? []) {
        const el = layer.createDiv({ cls: 'pwc-zotero-overlay-rect' });
        el.style.left = `${(rect.x / pageSize.width) * 100}%`;
        el.style.top = `${(rect.y / pageSize.height) * 100}%`;
        el.style.width = `${(rect.width / pageSize.width) * 100}%`;
        el.style.height = `${(rect.height / pageSize.height) * 100}%`;
        el.style.background = ann.color || '#ffd400';
        el.title = ann.comment || ann.text || 'Zotero annotation';
        el.style.pointerEvents = 'auto';
        el.addEventListener('click', (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          container
            .querySelectorAll('.pwc-zotero-popup-wrapper')
            .forEach((n) => n.remove());
          const popupWrapper = pageEl.createDiv({ cls: 'pwc-zotero-popup-wrapper' });
          popupWrapper.style.left = `${(rect.x / pageSize.width) * 100}%`;
          popupWrapper.style.top = `${(rect.y / pageSize.height) * 100}%`;
          const popup = popupWrapper.createDiv({ cls: 'popup' });
          popup.createDiv({
            cls: 'popupContent',
            text: (ann.comment || ann.text || '').trim() || 'Zotero annotation',
          });
          const meta = popup.createDiv({ cls: 'popupMeta' });
          meta.createDiv({
            cls: 'popupTitle',
            text: 'Zotero',
          });
          const copyBtn = meta.createEl('button', {
            cls: 'clickable-icon pwc-zotero-popup-copy',
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
            const citekey = state.citekey;
            const text = formatDocumentAnnotationReference(
              ann,
              state.vaultPath,
              citekey
            );
            void copyAnnotationReferenceNotice(text);
          });
        });
      }
    }
  });

  const onDocClick = (ev: MouseEvent) => {
    const t = ev.target as HTMLElement | null;
    if (t?.closest('.pwc-zotero-popup-wrapper, .pwc-zotero-overlay-rect')) return;
    container
      .querySelectorAll('.pwc-zotero-popup-wrapper')
      .forEach((el) => el.remove());
    document.removeEventListener('click', onDocClick, true);
  };
  document.addEventListener('click', onDocClick, true);
}

export function scheduleZoteroOverlayRender(plugin: ReferenceList): void {
  const delays = [0, 100, 300, 800, 1500, 2500];
  for (const delay of delays) {
    window.setTimeout(() => renderZoteroOverlayOnActivePdf(plugin), delay);
  }
}
