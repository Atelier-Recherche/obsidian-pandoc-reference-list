import type { PartialCSLEntry } from 'src/bib/types';

import type { StoredZoteroItem } from './types';

const SKIP_TYPES = new Set([
  'note',
  'attachment',
  'annotation',
  'folder',
  'dataset',
]);

/**
 * Clé de citation pour citeproc / @citekey : champ natif Zotero (Better BibTeX),
 * puis extra, puis clé API.
 */
export function resolveCitationKey(
  data: Record<string, unknown>,
  itemKey: string
): string {
  const ck =
    typeof data.citationKey === 'string' ? data.citationKey.trim() : '';
  if (ck) return ck;
  const fromExtra = extractCitationKeyFromExtra(data.extra);
  if (fromExtra) return fromExtra;
  return itemKey;
}

/** Extract Better-BibTeX / manual citation key from Zotero `extra` */
export function extractCitationKeyFromExtra(extra: unknown): string | null {
  if (typeof extra !== 'string' || !extra.trim()) return null;
  const m = extra.match(/(?:^|\n)\s*Citation\s*Key\s*:\s*(\S+)/i);
  if (m) return m[1];
  const m2 = extra.match(/(?:^|\n)\s*bibtex\s*:\s*(\S+)/i);
  if (m2) return m2[1];
  const m3 = extra.match(/(?:^|\n)\s*tex\.(?:citation|citekey)\s*:\s*(\S+)/i);
  if (m3) return m3[1];
  const m4 = extra.match(/@\w+\s*\{\s*([^,\s}]+)\s*,/);
  if (m4) return m4[1];
  return null;
}

/**
 * Retire les lignes `Citation Key:` de `extra` — la clé est portée par le champ
 * natif `citationKey` (Better BibTeX) pour éviter le doublon API + extra.
 */
export function stripCitationKeyLinesFromExtra(extra: unknown): string {
  return String(extra ?? '')
    .split('\n')
    .filter((line) => !/^\s*Citation\s*Key\s*:/i.test(line))
    .join('\n')
    .trimEnd();
}

/**
 * @deprecated Préférer `citationKey` + `stripCitationKeyLinesFromExtra` pour l’API.
 * Conservé si un flux externe exige encore une ligne dans `extra`.
 */
export function mergeCitationKeyIntoExtra(
  extra: string,
  citeKey: string
): string {
  const body = stripCitationKeyLinesFromExtra(extra);
  const ck = citeKey.trim();
  if (!ck) return body;
  const line = `Citation Key: ${ck}`;
  return body ? `${body}\n${line}` : line;
}

function mapCreator(
  c: Record<string, unknown>
): { family?: string; given?: string; literal?: string } | null {
  if (typeof c.name === 'string' && c.name.trim()) {
    return { literal: c.name.trim() };
  }
  const last = typeof c.lastName === 'string' ? c.lastName : '';
  const first = typeof c.firstName === 'string' ? c.firstName : '';
  if (!last && !first) return null;
  return { family: last || undefined, given: first || undefined };
}

function mapIssued(dateStr: unknown): { 'date-parts': number[][] } | undefined {
  if (typeof dateStr !== 'string' || !dateStr.trim()) return undefined;
  const parts = dateStr
    .split(/-|\//)
    .map((p) => parseInt(p, 10))
    .filter((n) => !isNaN(n));
  if (!parts.length) return undefined;
  return { 'date-parts': [parts] };
}

function zoteroTypeToCsl(itemType: string): string {
  const map: Record<string, string> = {
    journalArticle: 'article-journal',
    book: 'book',
    bookSection: 'chapter',
    conferencePaper: 'paper-conference',
    thesis: 'thesis',
    report: 'report',
    webpage: 'webpage',
    newspaperArticle: 'article-newspaper',
    magazineArticle: 'article-magazine',
    patent: 'patent',
    statute: 'legislation',
    bill: 'bill',
    hearing: 'speech',
    presentation: 'speech',
    interview: 'interview',
    letter: 'personal_communication',
    manuscript: 'manuscript',
    map: 'graphic',
    artwork: 'graphic',
    preprint: 'article-journal',
    blogPost: 'post-weblog',
    forumPost: 'post',
    instantMessage: 'personal_communication',
    email: 'personal_communication',
    tvBroadcast: 'broadcast',
    radioBroadcast: 'broadcast',
    podcast: 'broadcast',
    computerProgram: 'book',
    document: 'article',
  };
  return map[itemType] ?? 'article';
}

/**
 * Convert stored Zotero item to CSL-JSON-like entry for citeproc.
 * Returns null for types that should not appear in the bibliography list.
 */
export function zoteroItemToCsl(
  stored: StoredZoteroItem,
  groupID?: number
): PartialCSLEntry | null {
  const data = stored.data;
  const itemType = data.itemType as string | undefined;
  if (!itemType) return null;
  if (SKIP_TYPES.has(itemType)) return null;
  if (data.parentItem && (itemType === 'note' || itemType === 'attachment')) {
    return null;
  }

  const id = resolveCitationKey(data, stored.key);

  const title =
    (typeof data.title === 'string' && data.title) ||
    (typeof data.shortTitle === 'string' && data.shortTitle) ||
    id;

  const extraFields: Record<string, unknown> = {
    id,
    title,
    type: zoteroTypeToCsl(itemType),
  };

  if (groupID !== undefined) {
    (extraFields as PartialCSLEntry).groupID = groupID;
  }

  const creators = data.creators as Record<string, unknown>[] | undefined;
  if (creators?.length) {
    const authors: ReturnType<typeof mapCreator>[] = [];
    const editors: ReturnType<typeof mapCreator>[] = [];
    const translators: ReturnType<typeof mapCreator>[] = [];
    const collectionEditors: ReturnType<typeof mapCreator>[] = [];
    const containerAuthors: ReturnType<typeof mapCreator>[] = [];
    const composers: ReturnType<typeof mapCreator>[] = [];
    for (const c of creators) {
      const ct = (c.creatorType as string) || 'author';
      const mapped = mapCreator(c);
      if (!mapped) continue;
      switch (ct) {
        case 'editor':
          editors.push(mapped);
          break;
        case 'seriesEditor':
          collectionEditors.push(mapped);
          break;
        case 'translator':
          translators.push(mapped);
          break;
        case 'bookAuthor':
          containerAuthors.push(mapped);
          break;
        case 'composer':
          composers.push(mapped);
          break;
        case 'author':
        case 'contributor':
          authors.push(mapped);
          break;
        default:
          break;
      }
    }
    if (authors.length) (extraFields as any).author = authors;
    if (editors.length) (extraFields as any).editor = editors;
    if (translators.length) (extraFields as any).translator = translators;
    if (collectionEditors.length) {
      (extraFields as any)['collection-editor'] = collectionEditors;
    }
    if (containerAuthors.length) {
      (extraFields as any)['container-author'] = containerAuthors;
    }
    if (composers.length) (extraFields as any).composer = composers;
  }

  const issued = mapIssued(data.date);
  if (issued) (extraFields as any).issued = issued;

  if (typeof data.publicationTitle === 'string') {
    (extraFields as any)['container-title'] = data.publicationTitle;
  }
  if (typeof data.journalAbbreviation === 'string') {
    (extraFields as any)['container-title-short'] = data.journalAbbreviation;
  }
  if (typeof data.publisher === 'string') {
    (extraFields as any).publisher = data.publisher;
  }
  if (typeof data.place === 'string') {
    (extraFields as any)['publisher-place'] = data.place;
  }
  if (typeof data.DOI === 'string') {
    (extraFields as any).DOI = data.DOI;
  }
  if (typeof data.url === 'string') {
    (extraFields as any).URL = data.url;
  }
  if (typeof data.volume === 'string' || typeof data.volume === 'number') {
    (extraFields as any).volume = String(data.volume);
  }
  if (typeof data.issue === 'string' || typeof data.issue === 'number') {
    (extraFields as any).issue = String(data.issue);
  }
  if (typeof data.pages === 'string') {
    (extraFields as any).page = data.pages;
  }
  if (typeof data.ISBN === 'string') {
    (extraFields as any).ISBN = data.ISBN;
  }
  if (typeof data.ISSN === 'string') {
    (extraFields as any).ISSN = data.ISSN;
  }
  if (typeof data.language === 'string') {
    (extraFields as any).language = data.language;
  }
  if (typeof data.abstractNote === 'string') {
    (extraFields as any).abstract = data.abstractNote;
  }

  return extraFields as PartialCSLEntry;
}
