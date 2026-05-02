/** Champs Zotero Web API (bloc `data`) éditables en plus du cœur titre/date/publication */

export type ZoteroExtraFieldDef = {
  key: string;
  /** Clé passée à t() dans en.ts */
  labelKey: string;
  multiline?: boolean;
};

const BOOK_LIKE = new Set([
  'book',
  'bookSection',
  'thesis',
  'report',
  'manuscript',
  'document',
  'computerProgram',
]);

const JOURNAL_LIKE = new Set([
  'journalArticle',
  'magazineArticle',
  'newspaperArticle',
  'conferencePaper',
  'blogPost',
]);

/** Langue : menu déroulant séparé dans le modal (pas champ texte) */
const COMMON: ZoteroExtraFieldDef[] = [
  { key: 'shortTitle', labelKey: 'Short title' },
  { key: 'rights', labelKey: 'Rights' },
  { key: 'accessDate', labelKey: 'Access date' },
];

const BOOK_FIELDS: ZoteroExtraFieldDef[] = [
  { key: 'place', labelKey: 'Place' },
  { key: 'ISBN', labelKey: 'ISBN' },
  { key: 'numPages', labelKey: 'Number of pages' },
  { key: 'edition', labelKey: 'Edition' },
  { key: 'series', labelKey: 'Series' },
  { key: 'seriesNumber', labelKey: 'Series number' },
  { key: 'numberOfVolumes', labelKey: 'Number of volumes' },
  { key: 'archive', labelKey: 'Archive' },
  { key: 'archiveLocation', labelKey: 'Archive location' },
  { key: 'libraryCatalog', labelKey: 'Library catalog' },
  { key: 'callNumber', labelKey: 'Call number' },
  ...COMMON,
];

const JOURNAL_FIELDS: ZoteroExtraFieldDef[] = [
  { key: 'journalAbbreviation', labelKey: 'Journal abbreviation' },
  { key: 'volume', labelKey: 'Volume' },
  { key: 'issue', labelKey: 'Issue' },
  { key: 'pages', labelKey: 'Pages' },
  { key: 'ISSN', labelKey: 'ISSN' },
  ...COMMON,
];

export function getZoteroExtraEditableFields(
  itemType: string
): ZoteroExtraFieldDef[] {
  if (itemType === 'thesis') {
    return [
      { key: 'university', labelKey: 'University' },
      ...BOOK_FIELDS,
    ];
  }
  if (BOOK_LIKE.has(itemType)) {
    return BOOK_FIELDS.slice();
  }
  if (JOURNAL_LIKE.has(itemType)) {
    return JOURNAL_FIELDS.slice();
  }
  return COMMON.slice();
}
