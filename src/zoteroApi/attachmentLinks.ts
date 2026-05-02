import { Platform } from 'obsidian';

import { getFs, getPath } from 'src/platformAdapter';

import type { StoredZoteroItem } from './types';

export type ResolvedAttachmentLink =
  | { kind: 'zotero'; href: string }
  | { kind: 'local'; path: string }
  | { kind: 'web'; href: string };

/**
 * Chemin local exploitable pour une pièce jointe « fichier lié » (API Zotero).
 * Les chemins `attachments:…` (stockage interne Zotero) ne sont pas résolus ici.
 */
export function getLinkedFilePathFromAttachmentData(
  data: Record<string, unknown>
): string | null {
  const linkMode = String(data.linkMode ?? '');
  const raw = typeof data.path === 'string' ? data.path.trim() : '';
  if (!raw || raw.startsWith('attachments:')) return null;
  if (/^https?:\/\//i.test(raw)) return null;

  if (linkMode && linkMode !== 'linked_file') return null;

  const looksFs =
    /^[a-zA-Z]:[\\/]/.test(raw) ||
    raw.startsWith('\\\\') ||
    raw.startsWith('/');

  if (!looksFs) return null;

  if (!Platform.isDesktop) return raw;

  const fs = getFs();
  const pathMod = getPath();
  if (!fs) return raw;

  try {
    const norm = pathMod.normalize(raw);
    if (fs.existsSync(norm)) return norm;
    if (fs.existsSync(raw)) return raw;
  } catch {
    //
  }
  return raw;
}

export function resolveAttachmentLinks(
  att: StoredZoteroItem,
  zoteroUri: string | null
): ResolvedAttachmentLink[] {
  const d = att.data as Record<string, unknown>;
  const out: ResolvedAttachmentLink[] = [];

  if (zoteroUri) {
    out.push({ kind: 'zotero', href: zoteroUri });
  }

  const local = getLinkedFilePathFromAttachmentData(d);
  if (local) {
    out.push({ kind: 'local', path: local });
  }

  const url = typeof d.url === 'string' ? d.url.trim() : '';
  if (/^https?:\/\//i.test(url)) {
    out.push({ kind: 'web', href: url });
  }

  return out;
}
