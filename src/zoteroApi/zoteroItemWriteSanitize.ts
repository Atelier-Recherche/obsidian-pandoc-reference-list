/**
 * Retire les clés que l’API Zotero refuse ou régénère en écriture — sinon PATCH → 400.
 * @see https://www.zotero.org/support/dev/web_api/v3/write_requests
 */
const READ_ONLY_ITEM_DATA_KEYS = new Set([
  'dateAdded',
  'dateModified',
  'key',
]);

/** Champs souvent présents sur les pièces jointes et gérés par le serveur */
const ATTACHMENT_READ_ONLY = new Set(['md5', 'mtime', 'charset']);

export function stripReadOnlyZoteroItemData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const k of READ_ONLY_ITEM_DATA_KEYS) {
    delete out[k];
  }
  const it = String(out.itemType ?? '');
  if (it === 'attachment') {
    for (const k of ATTACHMENT_READ_ONLY) {
      delete out[k];
    }
  }
  return out;
}

/** Normalise un créateur pour l’API (pas de propriétés parasites). */
export function normalizeCreatorForZoteroWrite(
  c: Record<string, unknown>
): Record<string, unknown> | null {
  const creatorType = String(c.creatorType ?? 'author').trim() || 'author';
  const nameRaw = typeof c.name === 'string' ? c.name.trim() : '';
  if (nameRaw) {
    return { creatorType, name: nameRaw };
  }
  const firstName = typeof c.firstName === 'string' ? c.firstName : '';
  const lastName = typeof c.lastName === 'string' ? c.lastName : '';
  if (!firstName.trim() && !lastName.trim()) return null;
  return { creatorType, firstName, lastName };
}

export function normalizeCreatorsArrayForWrite(
  creators: unknown
): Record<string, unknown>[] | undefined {
  if (!Array.isArray(creators)) return undefined;
  if (creators.length === 0) return [];
  const out: Record<string, unknown>[] = [];
  for (const c of creators) {
    if (!c || typeof c !== 'object') continue;
    const n = normalizeCreatorForZoteroWrite(c as Record<string, unknown>);
    if (n) out.push(n);
  }
  return out;
}
