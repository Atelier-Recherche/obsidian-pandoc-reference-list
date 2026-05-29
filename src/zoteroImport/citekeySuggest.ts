/** Mots vides ignorés pour les initiales du titre (clé de citation). */
const TITLE_STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'de',
  'du',
  'l',
  'd',
  'and',
  'or',
  'et',
  'in',
  'on',
  'of',
  'pour',
  'sur',
  'with',
  'en',
]);

export function slugifyForCitekey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
    .slice(0, 40);
}

/** Premier auteur si liste (« Dupont et Martin », « A; B »). */
export function primaryAuthorName(author: string): string {
  const trimmed = author.trim();
  if (!trimmed) return '';
  const first = trimmed.split(/\s+(?:and|et|&|;)\s+/i)[0]?.trim();
  return first || trimmed;
}

/** Nom de famille : « Dupont, Jean » → Dupont ; « Jean Dupont » → Dupont. */
export function familyNameFromAuthor(author: string): string {
  const primary = primaryAuthorName(author);
  if (!primary) return '';
  if (primary.includes(',')) {
    return primary.split(',')[0]?.trim() ?? primary;
  }
  const parts = primary.split(/\s+/).filter(Boolean);
  return parts.length > 1 ? (parts[parts.length - 1] ?? primary) : primary;
}

/** Initiales des mots significatifs du titre (ex. « Deep Learning Notes » → dln). */
export function titleWordInitials(title: string, maxWords = 4): string {
  const words = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-zA-Z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !TITLE_STOP_WORDS.has(w.toLowerCase()));

  return words
    .slice(0, maxWords)
    .map((w) => w[0]?.toLowerCase() ?? '')
    .join('');
}

/** Ignore une « clé » qui est en fait le nom d’auteur/titre (bug regex ou saisie). */
export function isUsableExplicitCitekey(
  value: string | undefined,
  author: string,
  title: string
): boolean {
  const v = value?.trim();
  if (!v) return false;
  const a = author.trim();
  const ti = title.trim();
  if (a && v.localeCompare(a, undefined, { sensitivity: 'accent' }) === 0) {
    return false;
  }
  if (ti && v.localeCompare(ti, undefined, { sensitivity: 'accent' }) === 0) {
    return false;
  }
  if (/\s/.test(v) && !/\d/.test(v)) return false;
  return true;
}

/**
 * Clé du type auteurAnneeInitialesTitre — ex. dupont2024dln
 * (nom de famille + année fichier + initiales du titre).
 */
export function suggestCitekey(
  author: string,
  title: string,
  fileMtimeMs: number,
  existing?: string
): string {
  if (isUsableExplicitCitekey(existing, author, title)) {
    return existing!.trim();
  }

  const year = new Date(fileMtimeMs).getFullYear();
  const authorPart =
    slugifyForCitekey(familyNameFromAuthor(author)) || 'unknown';
  const initials = titleWordInitials(title);

  if (initials) return `${authorPart}${year}${initials}`;
  const titleFallback = slugifyForCitekey(title.split(/\s+/)[0] ?? '');
  if (titleFallback) return `${authorPart}${year}${titleFallback.slice(0, 8)}`;
  return `${authorPart}${year}`;
}
