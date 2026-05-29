import { PDFHexString, PDFName, PDFString } from 'pdf-lib';

export function decodePdfField(v: unknown): string {
  if (v instanceof PDFHexString || v instanceof PDFString) {
    return v.decodeText();
  }
  if (typeof v === 'string') return v;
  return '';
}

export function pdfField(
  dict: { get?: (name: PDFName) => unknown },
  name: string
): string {
  return decodePdfField(dict.get?.(PDFName.of(name)));
}
