import type { DocumentAnnotation } from '../../annotations/types';
import type { AnnotationSource } from '../../annotations/types';
import {
  viewportRectsToZotero,
  zoteroRectsToViewport,
} from './pdfCoordinates';

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfHighlight {
  id: string;
  pageIndex: number;
  rects: PdfRect[];
  text: string;
  comment: string;
  color: string;
  /** Opacité du surlignage (0–1). */
  opacity?: number;
  style?: 'highlight' | 'underline' | 'strikeout' | 'squiggly';
  source?: AnnotationSource;
}

export function pdfHighlightToDocumentAnnotation(h: PdfHighlight): DocumentAnnotation {
  return {
    id: h.id,
    source: h.source ?? 'local-pdf',
    text: h.text,
    comment: h.comment,
    color: h.color,
    pageIndex: h.pageIndex,
    pageLabel: String(h.pageIndex + 1),
    rects: h.rects,
  };
}

export function parseZoteroAnnotationPositionRaw(
  raw: string
): { pageIndex: number; zoteroRects: Array<[number, number, number, number]> } | null {
  try {
    const pos = JSON.parse(raw) as {
      pageIndex?: number;
      rects?: Array<[number, number, number, number]>;
    };
    if (pos.pageIndex == null || !Array.isArray(pos.rects) || !pos.rects.length) {
      return null;
    }
    return { pageIndex: pos.pageIndex, zoteroRects: pos.rects };
  } catch {
    return null;
  }
}

export function parseZoteroAnnotationPosition(
  raw: string,
  pageHeight: number
): { pageIndex: number; rects: PdfRect[] } | null {
  const parsed = parseZoteroAnnotationPositionRaw(raw);
  if (!parsed || pageHeight <= 0) return null;
  return {
    pageIndex: parsed.pageIndex,
    rects: zoteroRectsToViewport(parsed.zoteroRects, pageHeight),
  };
}

export function zoteroPositionFromHighlight(
  h: PdfHighlight,
  pageHeight: number
): string {
  const rects =
    pageHeight > 0
      ? viewportRectsToZotero(h.rects, pageHeight)
      : h.rects.map(
          (r) =>
            [r.x, r.y, r.x + r.width, r.y + r.height] as [
              number,
              number,
              number,
              number,
            ]
        );
  return JSON.stringify({ pageIndex: h.pageIndex, rects });
}

/** Format Zotero : `pageIndex|offset|yFromTop` (ex. `00008|000000|00574`). */
export function zoteroSortIndexFromHighlight(
  h: PdfHighlight,
  pageHeight?: number
): string {
  const page = String(h.pageIndex).padStart(5, '0');
  const r = h.rects[0];
  if (!r || pageHeight == null || pageHeight <= 0) {
    return `${page}|000000|00000`;
  }
  const yFromTop = Math.max(0, Math.floor(pageHeight - r.y - r.height));
  return `${page}|000000|${String(yFromTop).padStart(5, '0')}`;
}

export function colorToZoteroHex(color: string): string {
  const c = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  const rgb = c.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i
  );
  if (rgb) {
    const hex = (n: string) =>
      Math.min(255, parseInt(n, 10)).toString(16).padStart(2, '0');
    return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
  }
  return '#ffd400';
}

export function zoteroAnnotationTypeFromStyle(
  style?: PdfHighlight['style']
): string {
  switch (style) {
    case 'underline':
      return 'underline';
    case 'strikeout':
      return 'highlight';
    case 'squiggly':
      return 'underline';
    default:
      return 'highlight';
  }
}
