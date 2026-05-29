import type { DocumentAnnotation } from '../../annotations/types';
import type { ZoteroStoreSnapshot } from '../../zoteroApi/types';
import type ReferenceList from '../../main';

export function zoteroAnnotationsForEpubAttachment(
  snap: ZoteroStoreSnapshot,
  attachmentKey: string
): DocumentAnnotation[] {
  const out: DocumentAnnotation[] = [];
  for (const st of Object.values(snap.items)) {
    if (String(st.data.itemType) !== 'annotation') continue;
    const d = st.data as Record<string, unknown>;
    if (String(d.parentItem) !== attachmentKey) continue;
    out.push({
      id: `zotero-${st.key}`,
      source: 'zotero',
      text: String(d.annotationText ?? ''),
      comment: String(d.annotationComment ?? ''),
      color: String(d.annotationColor ?? '#ffd400'),
      cfi: String(d.annotationPosition ?? ''),
      zoteroKey: st.key,
    });
  }
  return out;
}

export async function pushEpubAnnotationToZotero(
  plugin: ReferenceList,
  attachmentKey: string,
  ann: DocumentAnnotation
): Promise<{ ok: boolean; error?: string }> {
  if (!plugin.settings.pullFromZoteroApi) {
    return { ok: false, error: 'zotero_api_disabled' };
  }
  return plugin.zoteroSync.createAnnotation(attachmentKey, {
    annotationType: 'highlight',
    annotationText: ann.text,
    annotationComment: ann.comment,
    annotationColor: ann.color ?? '#ffd400',
    annotationPosition: ann.cfi ?? JSON.stringify({ cfi: ann.cfi }),
  });
}
