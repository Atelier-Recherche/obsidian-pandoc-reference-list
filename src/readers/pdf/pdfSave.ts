import {
  PDFArray,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
} from 'pdf-lib';

import type { PdfHighlight, PdfRect } from './pdfAnnotationBridge';
import { decodePdfField } from './pdfLibField';

const DEFAULT_COLOR = { r: 1, g: 0.92, b: 0.23 };

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '').trim();
  if (h.length === 6) {
    const n = parseInt(h, 16);
    return {
      r: ((n >> 16) & 255) / 255,
      g: ((n >> 8) & 255) / 255,
      b: (n & 255) / 255,
    };
  }
  return DEFAULT_COLOR;
}

/** pdf.js viewport coords (top-left) → PDF coords (bottom-left) */
function toPdfLibRect(
  rect: PdfRect,
  pageHeight: number
): { x: number; y: number; width: number; height: number } {
  const y = pageHeight - rect.y - rect.height;
  return { x: rect.x, y, width: rect.width, height: rect.height };
}

function appendHighlightAnnotation(
  doc: PDFDocument,
  page: any,
  pdfRects: { x: number; y: number; width: number; height: number }[],
  color: { r: number; g: number; b: number },
  text: string,
  comment: string,
  id: string,
  style: 'highlight' | 'underline' | 'strikeout' | 'squiggly' = 'highlight',
  opacity = 0.35
): void {
  if (!pdfRects.length) return;

  const contentText = comment.trim();
  const titleText = (text || '').trim().slice(0, 500);
  const subtypeName =
    style === 'underline'
      ? 'Underline'
      : style === 'strikeout'
        ? 'StrikeOut'
        : style === 'squiggly'
          ? 'Squiggly'
          : 'Highlight';

  const quadPoints: number[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const rect of pdfRects) {
    const x1 = rect.x;
    const y1 = rect.y;
    const x2 = rect.x + rect.width;
    const y2 = rect.y + rect.height;
    quadPoints.push(x1, y2, x2, y2, x1, y1, x2, y1);
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  }

  const annot = doc.context.obj({
    Type: 'Annot',
    Subtype: subtypeName,
    Rect: [minX, minY, maxX, maxY],
    QuadPoints: quadPoints,
    C: [color.r, color.g, color.b],
    CA: Math.min(1, Math.max(0.05, opacity)),
    T: PDFHexString.fromText(titleText || 'PandoCit'),
    ...(contentText
      ? { Contents: PDFHexString.fromText(contentText) }
      : titleText
        ? { Contents: PDFHexString.fromText(titleText) }
        : {}),
    NM: PDFHexString.fromText(id),
    F: PDFNumber.of(4),
  });
  const annotRef = doc.context.register(annot);
  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (annots) {
    annots.push(annotRef);
  } else {
    page.node.set(PDFName.of('Annots'), doc.context.obj([annotRef]));
  }
}

/**
 * Embeds real PDF highlight annotations into the PDF bytes.
 */
export async function embedHighlightsInPdf(
  pdfBytes: Uint8Array,
  highlights: PdfHighlight[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const byPage = new Map<number, PdfHighlight[]>();
  for (const h of highlights) {
    if (!byPage.has(h.pageIndex)) byPage.set(h.pageIndex, []);
    byPage.get(h.pageIndex)!.push(h);
  }

  for (const [pageIndex, list] of byPage) {
    const page = doc.getPage(pageIndex);
    const { height: pageHeight } = page.getSize();
    for (const h of list) {
      const c = parseHexColor(h.color || '#ffeb3b');
      const opacity = h.opacity ?? 0.35;
      const pdfRects = h.rects.map((rect) => toPdfLibRect(rect, pageHeight));
      appendHighlightAnnotation(
        doc,
        page,
        pdfRects,
        c,
        h.text,
        h.comment,
        h.id,
        h.style ?? 'highlight',
        opacity
      );
    }
  }

  return doc.save();
}

function refKey(ref: unknown): string {
  if (ref && typeof ref === 'object' && 'toString' in ref) {
    return String((ref as { toString(): string }).toString());
  }
  return String(ref);
}

function refsToRemoveForAnnot(
  doc: PDFDocument,
  annot: { get?: (name: PDFName) => unknown }
): Set<string> {
  const keys = new Set<string>();
  const popupRef = annot?.get?.(PDFName.of('Popup'));
  if (popupRef) keys.add(refKey(popupRef));
  return keys;
}

function filterAnnotsOnPage(
  doc: PDFDocument,
  page: ReturnType<PDFDocument['getPage']>,
  shouldRemove: (ref: unknown, index: number, annot: unknown) => boolean
): boolean {
  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (!annots) return false;

  const removeKeys = new Set<string>();
  for (let i = 0; i < annots.size(); i++) {
    const ref = annots.get(i);
    const annot = doc.context.lookup(ref);
    if (shouldRemove(ref, i, annot)) {
      removeKeys.add(refKey(ref));
      const popups = annot
        ? refsToRemoveForAnnot(
            doc,
            annot as { get?: (name: PDFName) => unknown }
          )
        : new Set<string>();
      for (const k of popups) removeKeys.add(k);
    }
  }
  if (!removeKeys.size) return false;

  const keep: unknown[] = [];
  for (let i = 0; i < annots.size(); i++) {
    const ref = annots.get(i);
    if (removeKeys.has(refKey(ref))) continue;
    keep.push(ref);
  }
  if (keep.length === 0) {
    page.node.delete(PDFName.of('Annots'));
  } else {
    page.node.set(PDFName.of('Annots'), doc.context.obj(keep));
  }
  return true;
}

export type PdfAnnotationRemoveTarget =
  | { kind: 'pwc'; markerId: string }
  | { kind: 'index'; pageIndex: number; annotIndex: number };

export async function removePdfAnnotationFromPdf(
  pdfBytes: Uint8Array,
  target: PdfAnnotationRemoveTarget
): Promise<{ bytes: Uint8Array; removed: boolean }> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  let removed = false;

  if (target.kind === 'pwc') {
    const { markerId } = target;
    for (const page of doc.getPages()) {
      if (
        filterAnnotsOnPage(doc, page, (_ref, _i, annot) => {
          const a = annot as { get?: (name: PDFName) => unknown };
          const nm = decodePdfField(a?.get?.(PDFName.of('NM')));
          const contents = decodePdfField(a?.get?.(PDFName.of('Contents')));
          return (
            nm === markerId ||
            nm.includes(markerId) ||
            contents.includes(`[[PWC:${markerId}]]`) ||
            contents.includes(`[PWC:${markerId}]]`)
          );
        })
      ) {
        removed = true;
      }
    }
  } else {
    const page = doc.getPage(target.pageIndex);
    const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    if (annots && target.annotIndex >= 0 && target.annotIndex < annots.size()) {
      const refToRemove = annots.get(target.annotIndex);
      const annot = doc.context.lookup(refToRemove) as {
        get?: (name: PDFName) => unknown;
      };
      const popupKeys = annot ? refsToRemoveForAnnot(doc, annot) : new Set<string>();
      const removeKeys = new Set([refKey(refToRemove), ...popupKeys]);
      if (
        filterAnnotsOnPage(doc, page, (ref) => removeKeys.has(refKey(ref)))
      ) {
        removed = true;
      }
    }
  }

  return { bytes: await doc.save(), removed };
}

/** @deprecated Utiliser removePdfAnnotationFromPdf */
export async function removePandoCitAnnotationFromPdf(
  pdfBytes: Uint8Array,
  markerId: string
): Promise<{ bytes: Uint8Array; removed: boolean }> {
  return removePdfAnnotationFromPdf(pdfBytes, { kind: 'pwc', markerId });
}
