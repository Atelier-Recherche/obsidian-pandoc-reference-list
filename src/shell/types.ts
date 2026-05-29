export type ShellTab = 'references' | 'zotero' | 'document-annotations';

export const shellViewType = 'pwc-shell-view';

/** Legacy view types migrated to shell on load */
export const legacyViewTypes = [
  'ReferenceListView',
  'pwc-zotero-library-view',
] as const;
