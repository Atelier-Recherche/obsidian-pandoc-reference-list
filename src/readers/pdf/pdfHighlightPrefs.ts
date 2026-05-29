import type ReferenceList from '../../main';

export type PdfHighlightStyle =
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'squiggly';

export type PdfHighlightTarget = 'pdf' | 'zotero' | 'both';

export interface PdfHighlightPrefs {
  style: PdfHighlightStyle;
  target: PdfHighlightTarget;
  color: string;
  opacity: number;
}

const DEFAULT_PDF_HIGHLIGHT_PREFS: PdfHighlightPrefs = {
  style: 'highlight',
  target: 'both',
  color: '#ffd400',
  opacity: 0.35,
};

export function getPdfHighlightPrefs(plugin: ReferenceList): PdfHighlightPrefs {
  const s = plugin.settings;
  return {
    style: s.pdfHighlightLastStyle ?? DEFAULT_PDF_HIGHLIGHT_PREFS.style,
    target: s.pdfHighlightLastTarget ?? DEFAULT_PDF_HIGHLIGHT_PREFS.target,
    color: s.pdfHighlightLastColor ?? DEFAULT_PDF_HIGHLIGHT_PREFS.color,
    opacity:
      typeof s.pdfHighlightLastOpacity === 'number'
        ? s.pdfHighlightLastOpacity
        : DEFAULT_PDF_HIGHLIGHT_PREFS.opacity,
  };
}

export async function savePdfHighlightPrefs(
  plugin: ReferenceList,
  prefs: PdfHighlightPrefs
): Promise<void> {
  plugin.settings.pdfHighlightLastStyle = prefs.style;
  plugin.settings.pdfHighlightLastTarget = prefs.target;
  plugin.settings.pdfHighlightLastColor = prefs.color;
  plugin.settings.pdfHighlightLastOpacity = prefs.opacity;
  await plugin.saveSettings();
}
