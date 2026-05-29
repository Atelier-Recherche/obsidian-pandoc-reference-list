import type { VaultPdfImportMetadataRegex } from '../settings';

export interface ParsedPdfMetadata {
  title: string;
  author: string;
  citekey: string;
}

function defaultTitleFromPath(vaultPath: string): string {
  const base = vaultPath.split(/[/\\]/).pop() ?? vaultPath;
  return base.replace(/\.pdf$/i, '').trim() || base;
}

export function parsePdfMetadataFromPath(
  vaultPath: string,
  regex?: VaultPdfImportMetadataRegex
): ParsedPdfMetadata {
  const fallbackTitle = defaultTitleFromPath(vaultPath);
  const pattern = regex?.pattern?.trim();
  if (!pattern) {
    return { title: fallbackTitle, author: '', citekey: '' };
  }

  const source =
    regex?.source === 'relativePath'
      ? vaultPath.replace(/\\/g, '/')
      : (vaultPath.split(/[/\\]/).pop() ?? vaultPath);

  try {
    const re = new RegExp(pattern);
    const m = source.match(re);
    if (!m) {
      return { title: fallbackTitle, author: '', citekey: '' };
    }

    /** Sans nom de groupe : ne pas retomber sur capture 1 (sinon citekey = auteur). */
    const pick = (name?: string, idx?: number) => {
      if (name) {
        if (m.groups?.[name]) return String(m.groups[name]).trim();
        if (m[name]) return String(m[name]).trim();
        return '';
      }
      if (idx !== undefined) return String(m[idx] ?? '').trim();
      return '';
    };

    const title =
      pick(regex?.titleGroup, 2) || pick('title') || fallbackTitle;
    const author = pick(regex?.authorGroup, 1) || pick('author');
    const citekey = regex?.citekeyGroup
      ? pick(regex.citekeyGroup)
      : pick('citekey');
    return { title, author, citekey };
  } catch {
    return { title: fallbackTitle, author: '', citekey: '' };
  }
}

export function authorToCreators(author: string): Record<string, unknown>[] {
  const a = author.trim();
  if (!a) return [];
  if (a.includes(',')) {
    const last = a.split(',')[0].trim();
    const first = a.split(',').slice(1).join(',').trim();
    if (first) {
      return [{ creatorType: 'author', firstName: first, lastName: last }];
    }
  }
  const parts = a.split(/\s+/);
  if (parts.length >= 2) {
    return [
      {
        creatorType: 'author',
        firstName: parts.slice(0, -1).join(' '),
        lastName: parts[parts.length - 1],
      },
    ];
  }
  return [{ creatorType: 'author', name: a }];
}
