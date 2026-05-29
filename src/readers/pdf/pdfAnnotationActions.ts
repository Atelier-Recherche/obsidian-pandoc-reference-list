import { Notice, TFile } from 'obsidian';

import type { DocumentAnnotation } from '../../annotations/types';
import { t } from '../../lang/helpers';
import type ReferenceList from '../../main';
import {
  getCachedPdfPageSizes,
  refreshPdfPanelAnnotations,
} from './pdfPanelAnnotations';
import type { PdfHighlight } from './pdfAnnotationBridge';
import { embedHighlightsInPdf, removePdfAnnotationFromPdf } from './pdfSave';
import { parseOtherAnnotationId } from './pdfLibAnnotations';
import { markerIdFromAnnotationId } from './pwcMarker';
import { pushHighlightToZotero } from './zoteroPdfAnnotations';
import { findZoteroAttachmentKeyForVaultFile } from './zoteroAttachmentMatch';
import { scheduleZoteroOverlayRender } from './zoteroPdfOverlay';
import { askPdfConvertConfirm } from './pdfConvertConfirm';

function toHighlight(ann: DocumentAnnotation): PdfHighlight | null {
  if (ann.pageIndex == null || !ann.rects?.length) return null;
  return {
    id: ann.id.replace(/^pdf-/, ''),
    pageIndex: ann.pageIndex,
    rects: ann.rects.map((r) => ({ ...r })),
    text: ann.text || '',
    comment: ann.comment || '',
    color: ann.color || '#ffd400',
    style: 'highlight',
    source: ann.source,
  };
}

async function refreshPdfUi(plugin: ReferenceList, file: TFile): Promise<void> {
  await refreshPdfPanelAnnotations(plugin, file);
  scheduleZoteroOverlayRender(plugin);
}

export async function deleteDocumentAnnotation(
  plugin: ReferenceList,
  vaultPath: string,
  ann: DocumentAnnotation
): Promise<void> {
  const file = plugin.app.vault.getAbstractFileByPath(vaultPath);
  if (!(file instanceof TFile)) return;
  if (ann.source === 'zotero' && ann.zoteroKey) {
    const res = await plugin.zoteroSync.deleteLibraryItem(ann.zoteroKey);
    if (!res.ok) {
      new Notice(`${t('Delete failed')}: ${res.error ?? 'zotero'}`);
      return;
    }
    await plugin.zoteroSync.sync();
    await refreshPdfUi(plugin, file);
    return;
  }
  if (ann.source === 'local-pdf') {
    const bytes = await plugin.app.vault.readBinary(file);
    const other = parseOtherAnnotationId(ann.id);
    const { bytes: out, removed } = await removePdfAnnotationFromPdf(
      new Uint8Array(bytes),
      other
        ? {
            kind: 'index',
            pageIndex: other.pageIndex,
            annotIndex: other.annotIndex,
          }
        : { kind: 'pwc', markerId: markerIdFromAnnotationId(ann.id) }
    );
    if (!removed) {
      new Notice(t('Delete failed'));
      return;
    }
    await plugin.app.vault.modifyBinary(file, out);
    await refreshPdfUi(plugin, file);
    new Notice('Annotation supprimée');
  }
}

export async function convertAnnotationTarget(
  plugin: ReferenceList,
  vaultPath: string,
  ann: DocumentAnnotation,
  target: 'pdf' | 'zotero'
): Promise<void> {
  const choice = await askPdfConvertConfirm(plugin.app, target);
  if (!choice) return;

  const file = plugin.app.vault.getAbstractFileByPath(vaultPath);
  if (!(file instanceof TFile)) return;
  const h = toHighlight(ann);
  if (!h) {
    new Notice(t('Annotation has no position data'));
    return;
  }

  if (target === 'pdf') {
    const bytes = await plugin.app.vault.readBinary(file);
    const out = await embedHighlightsInPdf(new Uint8Array(bytes), [h]);
    await plugin.app.vault.modifyBinary(file, out);
  } else {
    const attachmentKey = await findZoteroAttachmentKeyForVaultFile(plugin, file);
    if (!attachmentKey) {
      new Notice(t('No Zotero attachment match for this PDF'));
      return;
    }
    const sizes = getCachedPdfPageSizes(file.path);
    const pageSize = h.pageIndex != null ? sizes?.get(h.pageIndex) : undefined;
    const res = await pushHighlightToZotero(
      plugin,
      attachmentKey,
      h,
      pageSize?.height
    );
    if (!res.ok) {
      new Notice(`${t('Zotero save failed')}: ${res.error ?? ''}`);
      return;
    }
    await plugin.zoteroSync.sync();
  }

  if (choice.deleteSource) {
    await deleteDocumentAnnotation(plugin, vaultPath, ann);
    return;
  }

  await refreshPdfUi(plugin, file);
  new Notice(
    target === 'zotero'
      ? 'Annotation copiée vers Zotero'
      : 'Annotation copiée dans le PDF'
  );
}
