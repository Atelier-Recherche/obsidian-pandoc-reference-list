import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFNumber,
} from 'pdf-lib';

import type { DocumentAnnotation } from '../../annotations/types';
import { stripPwcMarker } from './pwcMarker';
import { decodePdfField, pdfField } from './pdfLibField';

type PdfRect = { x: number; y: number; width: number; height: number };

function pdfRectToViewport(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  pageHeight: number
): PdfRect {
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
}

function rectsFromAnnot(
  annot: { get?: (name: PDFName) => unknown },
  pageHeight: number
): PdfRect[] {
  const rects: PdfRect[] = [];
  const rectArr = annot.get?.(PDFName.of('Rect'));
  if (rectArr instanceof PDFArray && rectArr.size() >= 4) {
    const nums = [];
    for (let i = 0; i < 4; i++) {
      const n = rectArr.get(i);
      nums.push(n instanceof PDFNumber ? n.asNumber() : Number(n));
    }
    rects.push(pdfRectToViewport(nums[0], nums[1], nums[2], nums[3], pageHeight));
  }
  return rects;
}

function parseTitleAndComment(title: string, contents: string): {
  text: string;
  comment: string;
} {
  const t = stripPwcMarker(title);
  const c = stripPwcMarker(contents);
  if (t && t !== 'PandoCit') {
    return { text: t, comment: c && c !== t ? c : '' };
  }
  return { text: c, comment: '' };
}

function colorFromAnnot(annot: { get?: (name: PDFName) => unknown }): string {
  const c = annot.get?.(PDFName.of('C'));
  if (!(c instanceof PDFArray) || c.size() < 3) return '#ffd400';
  const rgb: number[] = [];
  for (let i = 0; i < 3; i++) {
    const n = c.get(i);
    const v = n instanceof PDFNumber ? n.asNumber() : Number(n);
    rgb.push(Math.round(v * 255));
  }
  return `rgb(${rgb.join(',')})`;
}

function isPandoCitNm(nm: string): boolean {
  return /^pwc-\d+/.test(nm);
}

const MARKUP_SUBTYPES = new Set([
  'Highlight',
  'Underline',
  'StrikeOut',
  'Squiggly',
  'Text',
  'FreeText',
  'Ink',
  'Caret',
  'Stamp',
]);

/**
 * Lit les annotations in-PDF via pdf-lib (champ NM fiable) et regroupe par NM.
 */
export async function loadInPdfAnnotations(
  pdfBytes: Uint8Array
): Promise<DocumentAnnotation[]> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const grouped = new Map<
    string,
    DocumentAnnotation & { rects: PdfRect[] }
  >();

  for (let pageIndex = 0; pageIndex < doc.getPageCount(); pageIndex++) {
    const page = doc.getPage(pageIndex);
    const { height: pageHeight } = page.getSize();
    const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    if (!annots) continue;

    for (let i = 0; i < annots.size(); i++) {
      const ref = annots.get(i);
      const annot = doc.context.lookup(ref) as {
        get?: (name: PDFName) => unknown;
      };
      if (!annot?.get) continue;

      const subtype = pdfField(annot, 'Subtype');
      if (subtype === 'Link' || subtype === 'Widget' || subtype === 'Popup') {
        continue;
      }

      const nm = pdfField(annot, 'NM');
      const legacyContents = pdfField(annot, 'Contents');
      const legacyMatch =
        legacyContents.match(/\[\[PWC:([^\]]+)\]\]/) ||
        legacyContents.match(/\[PWC:([^\]]+)\]\]/);
      const markerId = isPandoCitNm(nm)
        ? nm
        : legacyMatch?.[1]?.trim() ?? '';

      const title = pdfField(annot, 'T');
      const contents = legacyContents;
      const { text, comment } = parseTitleAndComment(title, contents);
      const isMarkup = !subtype || MARKUP_SUBTYPES.has(subtype);

      if (!isMarkup) continue;
      if (!markerId && !text && !comment) continue;

      const rects = rectsFromAnnot(annot, pageHeight);
      const groupKey = markerId || `other-${pageIndex}-${i}`;
      const panelId = markerId ? `pdf-${markerId}` : `pdf-other-${pageIndex}-${i}`;

      const existing = grouped.get(groupKey);
      if (existing && markerId) {
        existing.rects.push(...rects);
        if (!existing.text && text) existing.text = text;
        if (!existing.comment && comment) existing.comment = comment;
      } else if (!existing) {
        grouped.set(groupKey, {
          id: panelId,
          source: 'local-pdf',
          text,
          comment,
          color: colorFromAnnot(annot),
          pageIndex,
          pageLabel: String(pageIndex + 1),
          rects,
        });
      }
    }
  }

  return Array.from(grouped.values());
}

/** Identifiant panneau `pdf-other-{page}-{index}` → position dans le tableau Annots. */
export function parseOtherAnnotationId(
  annId: string
): { pageIndex: number; annotIndex: number } | null {
  const m = annId.match(/^pdf-other-(\d+)-(\d+)$/);
  if (!m) return null;
  return { pageIndex: Number(m[1]), annotIndex: Number(m[2]) };
}
