import { normalizePath } from 'obsidian';
import type { App } from 'obsidian';

import type { ZoteroStoreSnapshot } from './types';
import { resolveCitationKey } from './zoteroToCsl';

/** Same idea as Zotero “Export library”: onlyworks that belong in a .bib, not PDF rows, notes, etc. */
export function shouldIncludeInBibExport(
  data: Record<string, unknown>
): boolean {
  const t = data.itemType as string | undefined;
  if (!t) return false;
  if (
    t === 'attachment' ||
    t === 'note' ||
    t === 'annotation' ||
    t === 'duplicate' ||
    t === 'computerProgram'
  ) {
    return false;
  }
  if (data.parentItem) return false;
  if (data.deleted === 1) return false;
  return true;
}

function escapeBibtexBraced(s: string): string {
  if (!s) return '{}';
  return (
    '{' +
    s
      .replace(/\\/g, '\\textbackslash ')
      .replace(/([{}#%&$])/g, '\\$1')
      .replace(/~/g, '\\textasciitilde ')
      .replace(/\^/g, '\\textasciicircum ') +
    '}'
  );
}

function yearFromDate(dateStr: unknown): string | undefined {
  if (typeof dateStr !== 'string' || !dateStr.trim()) return undefined;
  const m = dateStr.match(/^(\d{4})/);
  return m ? m[1] : undefined;
}

function langidFromZotero(lang: unknown): string | undefined {
  if (typeof lang !== 'string' || !lang) return undefined;
  const map: Record<string, string> = {
    en: 'english',
    eng: 'english',
    fr: 'french',
    fre: 'french',
    de: 'german',
    ger: 'german',
    es: 'spanish',
    it: 'italian',
    pt: 'portuguese',
  };
  const low = lang.toLowerCase().replace('_', '-').split('-')[0];
  return map[low] ?? lang;
}

function formatName(lastName: string, firstName: string): string {
  const l = (lastName || '').trim();
  const f = (firstName || '').trim();
  if (l && f) return `${l}, ${f}`;
  return l || f || '';
}

function creatorsToField(
  creators: unknown,
  role: 'author' | 'editor' | 'translator'
): string | undefined {
  if (!Array.isArray(creators)) return undefined;
  const parts: string[] = [];
  for (const c of creators) {
    if (!c || typeof c !== 'object') continue;
    const ct = (c as { creatorType?: string }).creatorType;
    if (ct !== role) continue;
    const name = (c as { name?: string }).name;
    if (typeof name === 'string' && name.trim()) {
      parts.push(name.trim());
      continue;
    }
    const last = String((c as { lastName?: string }).lastName ?? '');
    const first = String((c as { firstName?: string }).firstName ?? '');
    const formatted = formatName(last, first);
    if (formatted) parts.push(formatted);
  }
  if (!parts.length) return undefined;
  return parts.join(' and ');
}

function entryTypeForItem(itemType: string): string {
  const m: Record<string, string> = {
    book: 'book',
    bookSection: 'incollection',
    journalArticle: 'article',
    magazineArticle: 'article',
    newspaperArticle: 'article',
    conferencePaper: 'inproceedings',
    thesis: 'thesis',
    presentation: 'unpublished',
    report: 'report',
    webpage: 'online',
    patent: 'patent',
    statute: 'misc',
    bill: 'misc',
    preprint: 'article',
    manuscript: 'unpublished',
    map: 'misc',
    artwork: 'misc',
    blogPost: 'online',
    forumPost: 'online',
    letter: 'misc',
    interview: 'misc',
    film: 'misc',
    tvBroadcast: 'misc',
    radioBroadcast: 'misc',
    podcast: 'misc',
    document: 'misc',
    email: 'misc',
    instantMessage: 'misc',
    hearing: 'misc',
    computerProgram: 'software',
  };
  return m[itemType] ?? 'misc';
}

function citeKeyForItem(
  data: Record<string, unknown>,
  itemKey: string,
  used: Set<string>
): string {
  let raw = resolveCitationKey(data, itemKey);
  raw = raw.replace(/[^a-zA-Z0-9_\-:.]/g, '');
  if (!raw) raw = 'item';

  let k = raw;
  let n = 0;
  while (used.has(k)) {
    n++;
    k = `${raw}-${n}`;
  }
  used.add(k);
  return k;
}

function linesForEntry(
  bibtexType: string,
  citeKey: string,
  fields: Record<string, string | undefined>
): string {
  const entries = Object.entries(fields).filter(
    (e): e is [string, string] => typeof e[1] === 'string' && e[1].length > 0
  );
  if (!entries.length) {
    return `@${bibtexType}{${citeKey},\n}\n`;
  }
  const inner = entries.map(([k, v]) => `  ${k} = ${v}`).join(',\n');
  return `@${bibtexType}{${citeKey},\n${inner},\n}\n`;
}

function itemDataToFields(
  data: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {};

  const title =
    (typeof data.title === 'string' && data.title.trim()) ||
    (typeof data.shortTitle === 'string' && data.shortTitle.trim()) ||
    '';
  if (title) out.title = escapeBibtexBraced(title);

  const author = creatorsToField(data.creators, 'author');
  if (author) out.author = escapeBibtexBraced(author);

  const editor = creatorsToField(data.creators, 'editor');
  if (editor) out.editor = escapeBibtexBraced(editor);

  const translator = creatorsToField(data.creators, 'translator');
  if (translator) out.translator = escapeBibtexBraced(translator);

  const st = typeof data.shortTitle === 'string' ? data.shortTitle.trim() : '';
  if (st && st !== title) out.shorttitle = escapeBibtexBraced(st);

  const dateStr = data.date;
  const y = yearFromDate(dateStr);
  if (y) {
    out.date = `{${y}}`;
    out.year = `{${y}}`;
  }

  const pub = typeof data.publisher === 'string' ? data.publisher.trim() : '';
  if (pub) out.publisher = escapeBibtexBraced(pub);

  const place = typeof data.place === 'string' ? data.place.trim() : '';
  if (place) out.location = escapeBibtexBraced(place);

  const series = typeof data.series === 'string' ? data.series.trim() : '';
  if (series) out.series = escapeBibtexBraced(series);

  const sn =
    typeof data.seriesNumber === 'string' ? data.seriesNumber.trim() : '';
  if (sn) out.number = escapeBibtexBraced(sn);

  const edition = typeof data.edition === 'string' ? data.edition.trim() : '';
  if (edition) out.edition = escapeBibtexBraced(edition);

  const vol = typeof data.volume === 'string' ? data.volume.trim() : '';
  if (vol) out.volume = escapeBibtexBraced(vol);

  const issue = typeof data.issue === 'string' ? data.issue.trim() : '';
  if (issue) out.issue = escapeBibtexBraced(issue);

  const pages = typeof data.pages === 'string' ? data.pages.trim() : '';
  if (pages) out.pages = escapeBibtexBraced(pages);

  const numPages =
    typeof data.numPages === 'string' ? data.numPages.trim() : '';
  if (numPages) out.pagetotal = escapeBibtexBraced(numPages);

  const bt = typeof data.bookTitle === 'string' ? data.bookTitle.trim() : '';
  if (bt) out.booktitle = escapeBibtexBraced(bt);

  const pt =
    typeof data.publicationTitle === 'string'
      ? data.publicationTitle.trim()
      : '';
  if (pt) out.journal = escapeBibtexBraced(pt);

  const isbn = typeof data.ISBN === 'string' ? data.ISBN.trim() : '';
  if (isbn) out.isbn = escapeBibtexBraced(isbn);

  const doi = typeof data.DOI === 'string' ? data.DOI.trim() : '';
  if (doi) out.doi = escapeBibtexBraced(doi);

  const url = typeof data.url === 'string' ? data.url.trim() : '';
  if (url) out.url = escapeBibtexBraced(url);

  const lang = langidFromZotero(data.language);
  if (lang) out.langid = escapeBibtexBraced(lang);

  const abs =
    typeof data.abstractNote === 'string' ? data.abstractNote.trim() : '';
  if (abs) out.abstract = escapeBibtexBraced(abs);

  const cn = typeof data.callNumber === 'string' ? data.callNumber.trim() : '';
  if (cn) out.note = escapeBibtexBraced(cn);

  return out;
}

export function generateBibtexFromSnapshot(snap: ZoteroStoreSnapshot): string {
  const header =
    '% Pandoc Reference List — export BibTeX depuis la synchro API Zotero\n' +
    '% Entrées : ouvrages/articles de premier niveau uniquement (pas pièces jointes, notes, corbeille).\n\n';

  const usedKeys = new Set<string>();
  const blocks: string[] = [];

  const items = Object.values(snap.items).sort((a, b) => {
    const ta = (typeof a.data.title === 'string' && a.data.title) || a.key;
    const tb = (typeof b.data.title === 'string' && b.data.title) || b.key;
    return String(ta).localeCompare(String(tb));
  });

  for (const it of items) {
    const data = it.data as Record<string, unknown>;
    if (!shouldIncludeInBibExport(data)) continue;

    const bibType = entryTypeForItem(String(data.itemType ?? 'misc'));
    const citeKey = citeKeyForItem(data, it.key, usedKeys);
    const fields = itemDataToFields(data);
    if (!fields.title) {
      fields.title = escapeBibtexBraced(`[untitled:${citeKey}]`);
    }

    blocks.push(linesForEntry(bibType, citeKey, fields));
  }

  return header + blocks.join('\n');
}

export function countBibExportEntries(snap: ZoteroStoreSnapshot): number {
  let n = 0;
  for (const it of Object.values(snap.items)) {
    if (shouldIncludeInBibExport(it.data as Record<string, unknown>)) n++;
  }
  return n;
}

async function ensureParentFoldersForVaultPath(
  app: App,
  filePath: string
): Promise<void> {
  const norm = normalizePath(filePath);
  const segments = norm.split('/').filter(Boolean);
  if (segments.length <= 1) return;

  let acc = '';
  for (let i = 0; i < segments.length - 1; i++) {
    acc = acc ? `${acc}/${segments[i]}` : segments[i];
    if (app.vault.getAbstractFileByPath(acc)) continue;
    try {
      await app.vault.createFolder(acc);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/already exists/i.test(msg)) continue;
      if (app.vault.getAbstractFileByPath(acc)) continue;
      throw e;
    }
  }
}

export async function writeBibtexExportToVault(
  app: App,
  snap: ZoteroStoreSnapshot,
  vaultRelativePath: string
): Promise<{
  ok: boolean;
  error?: string;
  path?: string;
  entryCount?: number;
}> {
  const trimmed = vaultRelativePath.trim();
  if (!trimmed.toLowerCase().endsWith('.bib')) {
    return { ok: false, error: 'need_bib_extension' };
  }

  const norm = normalizePath(trimmed);
  const content = generateBibtexFromSnapshot(snap);
  const entryCount = countBibExportEntries(snap);

  try {
    await ensureParentFoldersForVaultPath(app, norm);
    await app.vault.adapter.write(norm, content);
    return { ok: true, path: norm, entryCount };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
