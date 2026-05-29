import { TFile } from 'obsidian';

import { resolveVaultRelativePdfPath } from '../../helpers';
import type ReferenceList from '../../main';
import { readerRegistry } from '../readerRegistry';
import type { ZoteroStoreSnapshot } from '../../zoteroApi/types';
import { getLinkedFilePathFromAttachmentData } from '../../zoteroApi/attachmentLinks';
import { parseStorageItemKey } from '../../zoteroApi/zoteroMerge';

/** Tous les identifiants possibles d'une pièce jointe dans le snapshot. */
export function collectAttachmentParentIds(
  snap: ZoteroStoreSnapshot,
  attachmentStorageKey: string
): Set<string> {
  const ids = new Set<string>();
  if (!attachmentStorageKey) return ids;

  ids.add(attachmentStorageKey);
  const plain = parseStorageItemKey(attachmentStorageKey).plainKey;
  ids.add(plain);

  const attachSt = snap.items[attachmentStorageKey];
  if (attachSt) {
    ids.add(attachSt.key);
    const dk = attachSt.data?.key;
    if (typeof dk === 'string' && dk.trim()) ids.add(dk.trim());
  }

  for (const [k, st] of Object.entries(snap.items)) {
    if (String(st.data.itemType) !== 'attachment') continue;
    if (parseStorageItemKey(k).plainKey !== plain) continue;
    ids.add(k);
    const dk = st.data?.key;
    if (typeof dk === 'string' && dk.trim()) ids.add(dk.trim());
  }

  return ids;
}

export function annotationBelongsToAttachment(
  snap: ZoteroStoreSnapshot,
  annotationParentItem: string,
  attachmentStorageKey: string
): boolean {
  if (!annotationParentItem || !attachmentStorageKey) return false;

  const parentIds = collectAttachmentParentIds(snap, attachmentStorageKey);
  if (parentIds.has(annotationParentItem)) return true;

  const parentPlain = parseStorageItemKey(annotationParentItem).plainKey;
  const attachPlain = parseStorageItemKey(attachmentStorageKey).plainKey;
  if (parentPlain === attachPlain) return true;

  const parentSt = snap.items[annotationParentItem];
  if (
    parentSt &&
    String(parentSt.data.itemType) === 'attachment' &&
    parseStorageItemKey(parentSt.key).plainKey === attachPlain
  ) {
    return true;
  }

  return false;
}

/** @deprecated Utiliser {@link annotationBelongsToAttachment} */
export function attachmentKeyMatchesParent(
  parentItem: string,
  attachmentKey: string
): boolean {
  if (!parentItem || !attachmentKey) return false;
  if (parentItem === attachmentKey) return true;
  const attach = parseStorageItemKey(attachmentKey);
  const parent = parseStorageItemKey(parentItem);
  return attach.plainKey === parent.plainKey;
}

/**
 * Trouve la pièce jointe Zotero liée à un PDF du coffre (chemin lié, puis nom de fichier).
 */
export async function findZoteroAttachmentKeyForVaultFile(
  plugin: ReferenceList,
  file: TFile,
  opts?: { fresh?: boolean }
): Promise<string | undefined> {
  if (!plugin.settings.pullFromZoteroApi) return undefined;

  if (!opts?.fresh) {
    const reg = readerRegistry.get();
    if (reg?.vaultPath === file.path && reg.zoteroAttachmentKey) {
      return reg.zoteroAttachmentKey;
    }
  }

  const snap = await plugin.zoteroSync.loadSnapshot();
  const normFile = file.path.replace(/\\/g, '/').toLowerCase();
  const fileName = normFile.split('/').pop() ?? '';

  let filenameMatch: string | undefined;
  let bestNameLen = 0;

  for (const st of Object.values(snap.items)) {
    if (String(st.data.itemType) !== 'attachment') continue;
    const d = st.data as Record<string, unknown>;

    const linked = getLinkedFilePathFromAttachmentData(d);
    if (linked) {
      const vaultPath = resolveVaultRelativePdfPath(linked);
      if (vaultPath && vaultPath.replace(/\\/g, '/').toLowerCase() === normFile) {
        return st.key;
      }
    }

    const rawPath = String(d.path ?? d.url ?? '');
    if (!rawPath || !fileName) continue;
    const name = rawPath.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? '';
    if (name && normFile.endsWith(name) && name.length >= bestNameLen) {
      bestNameLen = name.length;
      filenameMatch = st.key;
    }
  }

  return filenameMatch;
}
