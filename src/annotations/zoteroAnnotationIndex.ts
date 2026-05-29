import Fuse from 'fuse.js';

import type { ZoteroStoreSnapshot, StoredZoteroItem } from '../zoteroApi/types';
import { displayCitekeyForLibrary } from '../zoteroApi/zoteroToCsl';
import type { ZoteroAnnotationRow } from './types';
import type ReferenceList from '../main';

function rowTitle(st: StoredZoteroItem): string {
  const d = st.data;
  const it = String(d.itemType ?? '');
  const raw =
    (typeof d.title === 'string' && d.title.trim()) ||
    (typeof d.shortTitle === 'string' && d.shortTitle.trim()) ||
    '';
  if (raw) return raw;
  if (it === 'note' && typeof d.note === 'string') {
    return d.note.replace(/<[^>]+>/g, '').trim().slice(0, 80) || st.key;
  }
  return st.key;
}

export function resolveTopItemInfo(
  snap: ZoteroStoreSnapshot,
  startKey: string
): { title: string; citekey: string } {
  let key = startKey;
  let title = startKey;
  let citekey = '';
  const seen = new Set<string>();
  while (key && !seen.has(key)) {
    seen.add(key);
    const st = snap.items[key];
    if (!st) break;
    const d = st.data as Record<string, unknown>;
    if (!citekey) {
      citekey = displayCitekeyForLibrary(d, st.key);
    }
    const pid = d.parentItem;
    if (typeof pid === 'string' && snap.items[pid]) {
      key = pid;
      continue;
    }
    title = rowTitle(st);
    break;
  }
  return { title, citekey };
}

export function buildAnnotationRowsFromSnapshot(
  snap: ZoteroStoreSnapshot
): ZoteroAnnotationRow[] {
  const rows: ZoteroAnnotationRow[] = [];
  for (const st of Object.values(snap.items)) {
    if (String(st.data.itemType) !== 'annotation') continue;
    const d = st.data as Record<string, unknown>;
    const parentKey = String(d.parentItem ?? '');
    const parent = parentKey ? snap.items[parentKey] : undefined;
    const parentTitle = parent ? rowTitle(parent) : parentKey;
    const top = parentKey
      ? resolveTopItemInfo(snap, parentKey)
      : { title: parentTitle, citekey: '' };
    rows.push({
      key: st.key,
      annotationText: String(d.annotationText ?? ''),
      annotationComment: String(d.annotationComment ?? ''),
      annotationPageLabel: String(d.annotationPageLabel ?? ''),
      annotationColor: String(d.annotationColor ?? ''),
      annotationType: String(d.annotationType ?? 'highlight'),
      parentAttachmentKey: parentKey,
      parentTitle,
      topItemTitle: top.title,
      citekey: top.citekey,
    });
  }
  return rows;
}

const fuseOpts = {
  keys: [
    { name: 'annotationText', weight: 0.35 },
    { name: 'annotationComment', weight: 0.3 },
    { name: 'parentTitle', weight: 0.15 },
    { name: 'topItemTitle', weight: 0.1 },
    { name: 'citekey', weight: 0.05 },
    { name: 'annotationPageLabel', weight: 0.05 },
  ],
  threshold: 0.38,
  minMatchCharLength: 1,
};

export class ZoteroAnnotationIndex {
  private rows: ZoteroAnnotationRow[] = [];
  private fuse: Fuse<ZoteroAnnotationRow> | null = null;

  async refresh(plugin: ReferenceList): Promise<void> {
    const snap = await plugin.zoteroSync.loadSnapshot();
    this.rows = buildAnnotationRowsFromSnapshot(snap);
    this.fuse =
      this.rows.length > 0 ? new Fuse(this.rows, fuseOpts) : null;
  }

  getAll(): ZoteroAnnotationRow[] {
    return this.rows;
  }

  search(query: string): ZoteroAnnotationRow[] {
    const q = query.trim();
    if (!q) return this.rows;
    if (!this.fuse) return [];
    return this.fuse.search(q).map((r) => r.item);
  }
}
