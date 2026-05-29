import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import type ReferenceList from '../../main';
import { pdfGetDocumentInit } from './pdfAssets';
import { configurePdfWorker } from './pdfWorker';

export type PdfPageSize = { width: number; height: number };

export async function loadPdfPageSizes(
  plugin: ReferenceList,
  pdfBytes: Uint8Array
): Promise<Map<number, PdfPageSize>> {
  configurePdfWorker(plugin);
  const pageSizes = new Map<number, PdfPageSize>();
  const loading = pdfjsLib.getDocument(pdfGetDocumentInit(plugin, pdfBytes));
  const doc = await loading.promise;
  for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex++) {
    const page = await doc.getPage(pageIndex + 1);
    const vp = page.getViewport({ scale: 1 });
    pageSizes.set(pageIndex, { width: vp.width, height: vp.height });
  }
  await doc.destroy();
  return pageSizes;
}
