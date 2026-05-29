import { TFile } from 'obsidian';

import type ReferenceList from '../../main';
import type { DocumentAnnotation } from '../../annotations/types';
import { readerRegistry } from '../readerRegistry';
import { zoteroAnnotationsForAttachment } from './zoteroPdfAnnotations';
import { loadInPdfAnnotations } from './pdfLibAnnotations';
import { resolveCitekeyForZoteroAttachment } from '../../annotations/annotationReference';
import { findZoteroAttachmentKeyForVaultFile } from './zoteroAttachmentMatch';
import { parseStorageItemKey } from '../../zoteroApi/zoteroMerge';
import { loadPdfPageSizes, type PdfPageSize } from './pdfPageSizes';

const pageSizeCache = new Map<string, Map<number, PdfPageSize>>();

function sortAnnotationsByDocumentOrder(
  list: DocumentAnnotation[]
): DocumentAnnotation[] {
  return [...list].sort((a, b) => {
    const pa = a.pageIndex ?? Number.MAX_SAFE_INTEGER;
    const pb = b.pageIndex ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    const ya = a.rects?.[0]?.y ?? 0;
    const yb = b.rects?.[0]?.y ?? 0;
    if (ya !== yb) return ya - yb;
    const xa = a.rects?.[0]?.x ?? 0;
    const xb = b.rects?.[0]?.x ?? 0;
    if (xa !== xb) return xa - xb;
    return a.id.localeCompare(b.id);
  });
}

export function getCachedPdfPageSizes(
  vaultPath: string
): Map<number, PdfPageSize> | undefined {
  return pageSizeCache.get(vaultPath);
}

export async function refreshPdfPanelAnnotations(
  plugin: ReferenceList,
  file: TFile
): Promise<void> {
  const annotations: DocumentAnnotation[] = [];
  let zoteroAttachmentKey: string | undefined;

  if (plugin.settings.pullFromZoteroApi) {
    zoteroAttachmentKey = await findZoteroAttachmentKeyForVaultFile(plugin, file, {
      fresh: true,
    });
  }

  const bytes = await plugin.app.vault.readBinary(file);
  let pageSizes = new Map<number, PdfPageSize>();

  try {
    pageSizes = await loadPdfPageSizes(plugin, new Uint8Array(bytes));
    pageSizeCache.set(file.path, pageSizes);
  } catch (e) {
    console.warn('[PandoCit PDF] Failed to read page sizes', e);
  }

  try {
    annotations.push(...(await loadInPdfAnnotations(new Uint8Array(bytes))));
  } catch (e) {
    console.warn('[PandoCit PDF] Failed to read in-PDF annotations', e);
  }

  if (zoteroAttachmentKey && plugin.settings.pullFromZoteroApi) {
    try {
      const snap = await plugin.zoteroSync.loadSnapshot();
      const seen = new Set<string>();
      const addZotero = (list: typeof annotations) => {
        for (const ann of list) {
          if (seen.has(ann.id)) continue;
          seen.add(ann.id);
          annotations.push(ann);
        }
      };
      addZotero(
        zoteroAnnotationsForAttachment(snap, zoteroAttachmentKey, pageSizes)
      );
      const parsed = parseStorageItemKey(zoteroAttachmentKey);
      if (parsed.scope === 'group') {
        const raw = await plugin.zoteroSync.loadRawGroupSnapshot(parsed.groupId);
        addZotero(
          zoteroAnnotationsForAttachment(raw, parsed.plainKey, pageSizes)
        );
        addZotero(
          zoteroAnnotationsForAttachment(raw, zoteroAttachmentKey, pageSizes)
        );
      }
    } catch (e) {
      console.warn('[PandoCit PDF] Failed to read Zotero annotations', e);
    }
  }

  let citekey: string | undefined;
  if (zoteroAttachmentKey && plugin.settings.pullFromZoteroApi) {
    try {
      const snap = await plugin.zoteroSync.loadSnapshot();
      citekey = resolveCitekeyForZoteroAttachment(snap, zoteroAttachmentKey);
    } catch {
      //
    }
  }

  readerRegistry.set({
    kind: 'pdf',
    vaultPath: file.path,
    annotations: sortAnnotationsByDocumentOrder(annotations),
    zoteroAttachmentKey,
    citekey,
  });
  plugin.emitter.trigger('pwc-document-annotations-changed');
}
