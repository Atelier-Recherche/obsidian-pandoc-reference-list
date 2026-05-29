import type { PdfRect } from './pdfAnnotationBridge';

/** Rectangles en coordonnées viewport pdf.js (origine en haut à gauche, scale 1). */

/** Zotero / PDF natif : origine bas-gauche, rects [x1, y1, x2, y2]. */
export function zoteroRectsToViewport(
  zoteroRects: Array<[number, number, number, number]>,
  pageHeight: number
): PdfRect[] {
  return zoteroRects.map(([x1, y1, x2, y2]) => {
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const bottom = Math.min(y1, y2);
    const top = Math.max(y1, y2);
    return {
      x: left,
      y: pageHeight - top,
      width: right - left,
      height: top - bottom,
    };
  });
}

export function viewportRectsToZotero(
  rects: PdfRect[],
  pageHeight: number
): Array<[number, number, number, number]> {
  return rects.map((r) => {
    const x1 = r.x;
    const x2 = r.x + r.width;
    const yBottom = pageHeight - r.y - r.height;
    const yTop = pageHeight - r.y;
    return [x1, yBottom, x2, yTop];
  });
}
