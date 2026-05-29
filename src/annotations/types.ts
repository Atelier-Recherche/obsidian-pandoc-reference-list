export type AnnotationSource =
  | 'local-pdf'
  | 'zotero'
  | 'sidecar'
  | 'hypothesis';

export interface DocumentAnnotation {
  id: string;
  source: AnnotationSource;
  text: string;
  comment: string;
  color?: string;
  pageLabel?: string;
  pageIndex?: number;
  cfi?: string;
  zoteroKey?: string;
  created?: string;
  /** PDF rects in page space */
  rects?: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface ZoteroAnnotationRow {
  key: string;
  annotationText: string;
  annotationComment: string;
  annotationPageLabel: string;
  annotationColor: string;
  annotationType: string;
  parentAttachmentKey: string;
  parentTitle: string;
  topItemTitle: string;
  citekey: string;
}
