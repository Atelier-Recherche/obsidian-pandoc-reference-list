import type { ZoteroStoreSnapshot } from '../../zoteroApi/types';
import type { DocumentAnnotation } from '../../annotations/types';
import {
  parseZoteroAnnotationPosition,
  parseZoteroAnnotationPositionRaw,
  zoteroPositionFromHighlight,
  zoteroSortIndexFromHighlight,
  colorToZoteroHex,
  zoteroAnnotationTypeFromStyle,
} from './pdfAnnotationBridge';
import type { PdfHighlight } from './pdfAnnotationBridge';
import type ReferenceList from '../../main';
import { annotationBelongsToAttachment } from './zoteroAttachmentMatch';

type PageSize = { width: number; height: number };

export function zoteroAnnotationsForAttachment(
  snap: ZoteroStoreSnapshot,
  attachmentKey: string,
  pageSizes?: Map<number, PageSize>
): DocumentAnnotation[] {
  const out: DocumentAnnotation[] = [];
  for (const st of Object.values(snap.items)) {
    if (String(st.data.itemType ?? '').toLowerCase() !== 'annotation') continue;
    const d = st.data as Record<string, unknown>;
    if (
      !annotationBelongsToAttachment(
        snap,
        String(d.parentItem ?? ''),
        attachmentKey
      )
    ) {
      continue;
    }
    const rawPos = String(d.annotationPosition ?? '');
    const rawParsed = parseZoteroAnnotationPositionRaw(rawPos);
    const pageIndex = rawParsed?.pageIndex;
    const pageHeight =
      pageIndex != null ? pageSizes?.get(pageIndex)?.height ?? 0 : 0;
    let rects: DocumentAnnotation['rects'];
    if (rawParsed && pageHeight > 0) {
      rects = parseZoteroAnnotationPosition(rawPos, pageHeight)?.rects;
    }
    out.push({
      id: `zotero-${st.key}`,
      source: 'zotero',
      text: String(d.annotationText ?? ''),
      comment: String(d.annotationComment ?? ''),
      color: String(d.annotationColor ?? '#ffd400'),
      pageLabel: String(d.annotationPageLabel ?? ''),
      pageIndex: rawParsed?.pageIndex ?? pageIndex,
      rects,
      zoteroKey: st.key,
    });
  }
  return out;
}

export async function pushHighlightToZotero(
  plugin: ReferenceList,
  attachmentKey: string,
  highlight: PdfHighlight,
  pageHeight?: number
): Promise<{ ok: boolean; error?: string; key?: string }> {
  if (!plugin.settings.pullFromZoteroApi) {
    return { ok: false, error: 'zotero_api_disabled' };
  }
  return plugin.zoteroSync.createAnnotation(attachmentKey, {
    annotationType: zoteroAnnotationTypeFromStyle(highlight.style),
    annotationText: highlight.text,
    annotationComment: highlight.comment,
    annotationColor: colorToZoteroHex(highlight.color || '#ffd400'),
    annotationPageLabel: String(highlight.pageIndex + 1),
    annotationSortIndex: zoteroSortIndexFromHighlight(highlight, pageHeight),
    annotationPosition: zoteroPositionFromHighlight(
      highlight,
      pageHeight ?? 0
    ),
  });
}
