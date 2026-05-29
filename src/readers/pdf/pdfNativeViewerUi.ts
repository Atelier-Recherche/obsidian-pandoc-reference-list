import { Menu, Notice, TFile, debounce, setIcon } from 'obsidian';

import { copyTextToClipboard } from '../../annotations/annotationReference';
import { t } from '../../lang/helpers';
import type ReferenceList from '../../main';
import { pdfReaderViewType } from './PdfReaderView';
import { createPdfHighlightFromSelection } from './pdfCreateHighlight';
import { getPdfHighlightPrefs } from './pdfHighlightPrefs';

const TOOLBAR_BTN_CLASS = 'pwc-pdf-highlight-toolbar-btn';

function isObsidianNativePdfActive(plugin: ReferenceList): boolean {
  const file = plugin.app.workspace.getActiveFile();
  if (!(file instanceof TFile) || file.extension.toLowerCase() !== 'pdf') {
    return false;
  }
  const leaf = plugin.app.workspace.activeLeaf;
  if (!leaf || leaf.view.getViewType() === pdfReaderViewType) return false;
  const container = leaf.view?.containerEl;
  return !!container?.querySelector('.pdf-page-numbers, [data-page-number]');
}

function activePdfContainer(plugin: ReferenceList): HTMLElement | null {
  const leaf = plugin.app.workspace.activeLeaf;
  if (!leaf) return null;
  return leaf.view?.containerEl ?? null;
}

function highlightToolbarTitle(plugin: ReferenceList): string {
  const p = getPdfHighlightPrefs(plugin);
  const styleKey =
    p.style === 'highlight'
      ? 'Highlight style highlight'
      : p.style === 'underline'
        ? 'Highlight style underline'
        : p.style === 'strikeout'
          ? 'Highlight style strikeout'
          : 'Highlight style squiggly';
  const targetKey =
    p.target === 'pdf'
      ? 'Highlight target pdf'
      : p.target === 'zotero'
        ? 'Highlight target zotero'
        : 'Highlight target both';
  return `${t('Highlight selection in PDF')} (${t(styleKey)} · ${t(targetKey)})`;
}

function getSelectionText(): string {
  return window.getSelection()?.toString().trim() ?? '';
}

async function copyPdfSelection(): Promise<void> {
  const text = getSelectionText();
  if (!text) return;
  const ok = await copyTextToClipboard(text);
  if (!ok) new Notice(t('Copy failed'));
}

function injectPdfHighlightToolbarButton(plugin: ReferenceList): void {
  if (!isObsidianNativePdfActive(plugin)) return;

  const container = activePdfContainer(plugin);
  if (!container) return;

  const pageNumbers = container.querySelector('.pdf-page-numbers');
  if (!pageNumbers?.parentElement) return;

  const title = highlightToolbarTitle(plugin);
  const existing = pageNumbers.nextElementSibling;
  if (existing?.classList.contains(TOOLBAR_BTN_CLASS)) {
    existing.setAttribute('aria-label', title);
    (existing as HTMLButtonElement).title = title;
    return;
  }

  container.querySelectorAll(`.${TOOLBAR_BTN_CLASS}`).forEach((el) => el.remove());

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `clickable-icon ${TOOLBAR_BTN_CLASS}`;
  btn.setAttribute('aria-label', title);
  btn.title = title;
  setIcon(btn, 'highlighter');
  btn.addEventListener(
    'pointerdown',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    { capture: true }
  );
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void createPdfHighlightFromSelection(plugin, { useSavedPrefs: true });
  });
  pageNumbers.insertAdjacentElement('afterend', btn);
}

function selectionInActivePdf(): boolean {
  return getSelectionText().length > 0;
}

function contextTargetInPdf(evt: MouseEvent): boolean {
  const t = evt.target;
  if (!(t instanceof Node)) return false;
  const el = t instanceof HTMLElement ? t : t.parentElement;
  if (!el) return false;
  return !!el.closest('[data-page-number], .pdf-viewer, .pdf-toolbar, .workspace-leaf');
}

export function registerPdfNativeViewerUi(plugin: ReferenceList): void {
  const scheduleInject = debounce(
    () => injectPdfHighlightToolbarButton(plugin),
    120,
    true
  );

  plugin.registerEvent(
    plugin.app.workspace.on('active-leaf-change', scheduleInject)
  );
  plugin.registerEvent(
    plugin.app.workspace.on('layout-change', scheduleInject)
  );
  plugin.registerEvent(
    plugin.app.workspace.on('file-open', () => {
      scheduleInject();
      window.setTimeout(scheduleInject, 400);
    })
  );

  plugin.registerDomEvent(
    document,
    'contextmenu',
    (evt) => {
      if (!isObsidianNativePdfActive(plugin)) return;
      if (!selectionInActivePdf()) return;
      if (!contextTargetInPdf(evt)) return;

      evt.preventDefault();
      evt.stopPropagation();

      const menu = new Menu();
      menu.addItem((item) => {
        item.setTitle(t('Copy selection'));
        item.setIcon('copy');
        item.onClick(() => {
          void copyPdfSelection();
        });
      });
      menu.addSeparator();
      menu.addItem((item) => {
        item.setTitle(t('Highlight with last settings'));
        item.setIcon('highlighter');
        item.onClick(() => {
          void createPdfHighlightFromSelection(plugin, { useSavedPrefs: true });
        });
      });
      menu.addItem((item) => {
        item.setTitle(t('Highlight with options…'));
        item.setIcon('settings');
        item.onClick(() => {
          void createPdfHighlightFromSelection(plugin, { showModal: true });
        });
      });
      menu.showAtMouseEvent(evt);
    },
    { capture: true }
  );

  scheduleInject();
}
