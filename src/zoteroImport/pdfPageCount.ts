import type ReferenceList from '../main';
import { loadPdfPageSizes } from '../readers/pdf/pdfPageSizes';

export async function countPdfPages(
  plugin: ReferenceList,
  bytes: Uint8Array
): Promise<number> {
  const sizes = await loadPdfPageSizes(plugin, bytes);
  return sizes.size;
}
