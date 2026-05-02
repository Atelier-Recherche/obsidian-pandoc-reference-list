import type ReferenceList from 'src/main';
import { Notice } from 'obsidian';

import type {
  StoredZoteroItem,
  SyncResult,
  ZoteroStoreSnapshot,
} from './types';
import {
  normalizeCreatorsArrayForWrite,
  stripReadOnlyZoteroItemData,
} from './zoteroItemWriteSanitize';
import { ZoteroApiClient, parseItemArray } from './zoteroApiClient';
import type { ZoteroApiItemEnvelope } from './zoteroApiClient';
import { ZoteroStore, libraryCacheFileId } from './zoteroStore';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function mergeVersionMaps(
  a: Record<string, number> | null | undefined,
  b: Record<string, number> | null | undefined
): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    if (!Number.isFinite(n)) continue;
    if (out[k] === undefined || out[k] < n) out[k] = n;
  }
  return out;
}

function parseVersionsJson(text: string): Record<string, number> {
  try {
    const j = JSON.parse(text) as Record<string, number>;
    if (!j || typeof j !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(j)) {
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export class ZoteroSyncService {
  client: ZoteroApiClient;
  store: ZoteroStore;

  constructor(private plugin: ReferenceList) {
    this.client = new ZoteroApiClient({
      apiKey: plugin.settings.zoteroApiKey ?? '',
    });
    this.store = new ZoteroStore(plugin.app);
  }

  updateApiKey() {
    this.client.setApiKey(this.plugin.settings.zoteroApiKey ?? '');
  }

  getFileId(): string {
    const s = this.plugin.settings;
    const uid = s.zoteroApiUserId ?? 0;
    if (s.zoteroApiLibraryType === 'group' && s.zoteroApiGroupId != null) {
      return libraryCacheFileId(uid, 'group', s.zoteroApiGroupId);
    }
    return libraryCacheFileId(uid, 'user');
  }

  getLibraryPrefix(): string {
    const s = this.plugin.settings;
    if (s.zoteroApiLibraryType === 'group' && s.zoteroApiGroupId != null) {
      return `/groups/${s.zoteroApiGroupId}`;
    }
    const uid = s.zoteroApiUserId;
    return `/users/${uid}`;
  }

  async loadSnapshot(): Promise<ZoteroStoreSnapshot> {
    return this.store.load(this.getFileId());
  }

  async saveSnapshot(snap: ZoteroStoreSnapshot): Promise<void> {
    await this.store.save(this.getFileId(), snap);
  }

  /** Noms des dossiers Zotero (collections) pour l’arborescence du panneau */
  async fetchCollectionNames(): Promise<Map<string, string>> {
    this.updateApiKey();
    const prefix = this.getLibraryPrefix();
    const map = new Map<string, string>();
    let start = 0;
    const limit = 100;
    for (let guard = 0; guard < 100; guard++) {
      const res = await this.client.request(
        `${prefix}/collections?start=${start}&limit=${limit}&format=json`
      );
      if (res.status !== 200 || !res.text?.trim()) break;
      let rows: unknown[];
      try {
        rows = JSON.parse(res.text) as unknown[];
      } catch {
        break;
      }
      if (!Array.isArray(rows) || rows.length === 0) break;
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const r = row as { key?: string; data?: { name?: string } };
        const key = r.key;
        const name = r.data?.name;
        if (typeof key === 'string' && typeof name === 'string' && name) {
          map.set(key, name);
        }
      }
      if (rows.length < limit) break;
      start += limit;
    }
    return map;
  }

  async refreshUserIdFromApi(): Promise<boolean> {
    const key = this.plugin.settings.zoteroApiKey?.trim();
    if (!key) return false;
    this.updateApiKey();
    const cur = await this.client.keysCurrent();
    if (!cur?.userID) return false;
    this.plugin.settings.zoteroApiUserId = cur.userID;
    await this.plugin.saveSettings();
    return true;
  }

  /**
   * Merge edited fields into an item and PATCH the server (single-object write).
   */
  async saveItemEdits(
    itemKey: string,
    patch: Record<string, unknown>
  ): Promise<{ ok: boolean; error?: string }> {
    this.updateApiKey();
    const prefix = this.getLibraryPrefix();
    const snap = await this.loadSnapshot();
    const it = snap.items[itemKey];
    if (!it) return { ok: false, error: 'not_found' };

    let merged = stripReadOnlyZoteroItemData({ ...it.data });
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined && k !== 'creators') {
        merged[k] = v;
      }
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'creators')) {
      const normalized = normalizeCreatorsArrayForWrite(patch.creators);
      if (normalized !== undefined) {
        merged.creators = normalized;
      }
    }
    merged = stripReadOnlyZoteroItemData(merged);
    /** PATCH /items/{key} attend un objet partiel, pas un tableau (sinon 400). */
    const body = JSON.stringify({ ...merged, key: it.key, version: it.version });
    const res = await this.client.patchItem(prefix, itemKey, it.version, body);

    if (res.status === 412) {
      return { ok: false, error: '412' };
    }
    if (res.status < 200 || res.status >= 300) {
      let detail = `http_${res.status}`;
      try {
        const j = JSON.parse(res.text) as { message?: string };
        if (typeof j?.message === 'string' && j.message.trim()) {
          detail = `${detail}: ${j.message.trim()}`;
        }
      } catch {
        //
      }
      return { ok: false, error: detail };
    }

    const envelopes = parseItemArray(res.text) as ZoteroApiItemEnvelope[];
    let env = envelopes[0];
    if (
      !env?.data &&
      (res.status === 204 || !res.text?.trim())
    ) {
      const getRes = await this.client.request(
        `${prefix}/items/${itemKey}?format=json&includeTrashed=1`
      );
      if (getRes.status === 200 && getRes.text) {
        const again = parseItemArray(getRes.text) as ZoteroApiItemEnvelope[];
        env = again[0];
      }
    }

    const serverData = env?.data ?? merged;
    let serverVersion = env?.version;
    if (serverVersion === undefined || serverVersion === null) {
      serverVersion =
        res.lastModifiedVersion != null
          ? res.lastModifiedVersion
          : it.version;
    }

    snap.items[itemKey] = {
      key: env?.key ?? it.key,
      version: serverVersion,
      synced: true,
      conflict: false,
      data: serverData,
    };
    if (res.lastModifiedVersion != null) {
      snap.libraryVersion = Math.max(
        snap.libraryVersion,
        res.lastModifiedVersion
      );
    }
    await this.saveSnapshot(snap);
    return { ok: true };
  }

  /** Apply remote copy when resolving a conflict */
  async fetchAndOverwriteItem(itemKey: string): Promise<boolean> {
    this.updateApiKey();
    const prefix = this.getLibraryPrefix();
    const res = await this.client.request(
      `${prefix}/items/${itemKey}?format=json&includeTrashed=1`
    );
    if (res.status !== 200) return false;
    const envelopes = parseItemArray(res.text) as ZoteroApiItemEnvelope[];
    const env = envelopes[0];
    if (!env?.data) return false;
    const snap = await this.loadSnapshot();
    snap.items[itemKey] = {
      key: env.key,
      version: env.version,
      synced: true,
      data: env.data,
      conflict: false,
    };
    await this.saveSnapshot(snap);
    return true;
  }

  async sync(): Promise<SyncResult> {
    this.updateApiKey();
    const apiKey = this.plugin.settings.zoteroApiKey?.trim();
    if (!apiKey) {
      return {
        ok: false,
        libraryVersion: 0,
        downloaded: 0,
        uploaded: 0,
        deleted: 0,
        skippedConflicts: 0,
        error: 'missing_api_key',
      };
    }

    if (!this.plugin.settings.zoteroApiUserId) {
      const ok = await this.refreshUserIdFromApi();
      if (!ok) {
        return {
          ok: false,
          libraryVersion: 0,
          downloaded: 0,
          uploaded: 0,
          deleted: 0,
          skippedConflicts: 0,
          error: 'keys_current_failed',
        };
      }
    }

    const prefix = this.getLibraryPrefix();
    let downloaded = 0;
    let uploaded = 0;
    let deleted = 0;
    let skippedConflicts = 0;

    const maxRounds = 12;
    for (let round = 0; round < maxRounds; round++) {
      let snap = await this.loadSnapshot();

      // --- 1) Upload dirty items
      const dirtyKeys = Object.keys(snap.items).filter(
        (k) => snap.items[k] && !snap.items[k].synced && !snap.items[k].conflict
      );

      let hit412 = false;
      for (const key of dirtyKeys) {
        const it = snap.items[key];
        const payload = stripReadOnlyZoteroItemData({ ...it.data });
        const body = JSON.stringify({
          ...payload,
          key: it.key,
          version: it.version,
        });
        const res = await this.client.patchItem(prefix, key, it.version, body);

        if (res.status === 412) {
          hit412 = true;
          break;
        }

        if (res.status >= 200 && res.status < 300) {
          uploaded++;
          const envelopes = parseItemArray(res.text) as ZoteroApiItemEnvelope[];
          const env = envelopes[0];
          if (env?.version != null) {
            snap.items[key] = {
              key: env.key,
              version: env.version,
              synced: true,
              data: env.data ?? it.data,
              conflict: false,
            };
          } else if (res.lastModifiedVersion != null) {
            snap.items[key] = {
              ...it,
              version: res.lastModifiedVersion,
              synced: true,
              conflict: false,
            };
          } else {
            snap.items[key] = { ...it, synced: true, conflict: false };
          }
          if (res.lastModifiedVersion != null) {
            snap.libraryVersion = Math.max(
              snap.libraryVersion,
              res.lastModifiedVersion
            );
          }
        }
      }

      await this.saveSnapshot(snap);

      if (hit412) {
        const pull = await this.pullIncremental(prefix);
        downloaded += pull.downloaded;
        deleted += pull.deleted;
        skippedConflicts += pull.skippedConflicts;
        await this.saveSnapshot(pull.snap);
        continue;
      }

      snap = await this.loadSnapshot();
      const readSince = snap.libraryVersion;

      // --- 2) Remote unchanged?
      const colRes = await this.client.request(
        `${prefix}/collections?since=${readSince}&format=versions`,
        { ifModifiedSinceVersion: readSince }
      );

      if (colRes.status === 304) {
        if (colRes.lastModifiedVersion != null) {
          snap.libraryVersion = Math.max(
            snap.libraryVersion,
            colRes.lastModifiedVersion
          );
        }
        await this.saveSnapshot(snap);
        break;
      }

      if (colRes.status !== 200) {
        return {
          ok: false,
          libraryVersion: snap.libraryVersion,
          downloaded,
          uploaded,
          deleted,
          skippedConflicts,
          error: `collections_${colRes.status}`,
        };
      }

      // --- 3) Item version maps
      const topRes = await this.client.request(
        `${prefix}/items/top?since=${readSince}&format=versions&includeTrashed=1`
      );
      const allRes = await this.client.request(
        `${prefix}/items?since=${readSince}&format=versions&includeTrashed=1`
      );

      const vTop = topRes.status === 200 ? parseVersionsJson(topRes.text) : {};
      const vAll = allRes.status === 200 ? parseVersionsJson(allRes.text) : {};
      const merged = mergeVersionMaps(vTop, vAll);

      for (const rk of [...snap.retryFetchKeys]) {
        if (!merged[rk]) merged[rk] = Number.MAX_SAFE_INTEGER;
      }

      const toFetch: string[] = [];
      for (const [itemKey, remoteVer] of Object.entries(merged)) {
        const local = snap.items[itemKey];
        if (!local) {
          toFetch.push(itemKey);
          continue;
        }
        if (remoteVer <= local.version) continue;
        if (!local.synced) {
          local.conflict = true;
          skippedConflicts++;
          continue;
        }
        toFetch.push(itemKey);
      }

      let roundDl = 0;
      let maxLibVer = snap.libraryVersion;
      for (const group of chunk(toFetch, 50)) {
        const path = `${prefix}/items?itemKey=${group.join(
          ','
        )}&format=json&includeTrashed=1`;
        const res = await this.client.request(path);
        if (res.status !== 200) continue;
        const envelopes = parseItemArray(res.text) as ZoteroApiItemEnvelope[];
        for (const env of envelopes) {
          applyRemoteEnvelope(snap, env);
          roundDl++;
        }
        if (res.lastModifiedVersion != null) {
          maxLibVer = Math.max(maxLibVer, res.lastModifiedVersion);
        }
      }
      downloaded += roundDl;

      // --- 4) Deletes (same ?since= as version-map requests per Zotero sync docs)
      const delRes = await this.client.request(
        `${prefix}/deleted?since=${readSince}`
      );
      if (delRes.status === 200 && delRes.text) {
        try {
          const dj = JSON.parse(delRes.text) as {
            items?: string[];
          };
          for (const ik of dj.items ?? []) {
            const loc = snap.items[ik];
            if (loc && !loc.synced) {
              loc.conflict = true;
              skippedConflicts++;
              continue;
            }
            delete snap.items[ik];
            deleted++;
          }
        } catch {
          //
        }
      }
      if (delRes.lastModifiedVersion != null) {
        maxLibVer = Math.max(maxLibVer, delRes.lastModifiedVersion);
      }

      const metaVers = [
        colRes.lastModifiedVersion,
        topRes.lastModifiedVersion,
        allRes.lastModifiedVersion,
        delRes.lastModifiedVersion,
      ].filter((v): v is number => v != null);
      if (metaVers.length) {
        maxLibVer = Math.max(maxLibVer, ...metaVers);
      }
      snap.libraryVersion = maxLibVer;

      await this.saveSnapshot(snap);

      const stillDirty = Object.keys(snap.items).some(
        (k) => snap.items[k] && !snap.items[k].synced && !snap.items[k].conflict
      );
      if (!stillDirty && roundDl === 0) {
        break;
      }
    }

    const finalSnap = await this.loadSnapshot();
    return {
      ok: true,
      libraryVersion: finalSnap.libraryVersion,
      downloaded,
      uploaded,
      deleted,
      skippedConflicts,
    };
  }

  private async pullIncremental(prefix: string): Promise<{
    snap: ZoteroStoreSnapshot;
    downloaded: number;
    deleted: number;
    skippedConflicts: number;
  }> {
    const snap = await this.loadSnapshot();
    const readSince = snap.libraryVersion;
    let downloaded = 0;
    let deleted = 0;
    let skippedConflicts = 0;

    const topRes = await this.client.request(
      `${prefix}/items/top?since=${readSince}&format=versions&includeTrashed=1`
    );
    const allRes = await this.client.request(
      `${prefix}/items?since=${readSince}&format=versions&includeTrashed=1`
    );

    const vTop = topRes.status === 200 ? parseVersionsJson(topRes.text) : {};
    const vAll = allRes.status === 200 ? parseVersionsJson(allRes.text) : {};
    const merged = mergeVersionMaps(vTop, vAll);

    const toFetch: string[] = [];
    for (const [itemKey, remoteVer] of Object.entries(merged)) {
      const local = snap.items[itemKey];
      if (!local) {
        toFetch.push(itemKey);
        continue;
      }
      if (remoteVer <= local.version) continue;
      if (!local.synced) {
        local.conflict = true;
        skippedConflicts++;
        continue;
      }
      toFetch.push(itemKey);
    }

    let maxLibVer = snap.libraryVersion;
    for (const group of chunk(toFetch, 50)) {
      const path = `${prefix}/items?itemKey=${group.join(
        ','
      )}&format=json&includeTrashed=1`;
      const res = await this.client.request(path);
      if (res.status !== 200) continue;
      const envelopes = parseItemArray(res.text) as ZoteroApiItemEnvelope[];
      for (const env of envelopes) {
        applyRemoteEnvelope(snap, env);
        downloaded++;
      }
      if (res.lastModifiedVersion != null) {
        maxLibVer = Math.max(maxLibVer, res.lastModifiedVersion);
      }
    }

    const delRes = await this.client.request(
      `${prefix}/deleted?since=${readSince}`
    );
    if (delRes.status === 200 && delRes.text) {
      try {
        const dj = JSON.parse(delRes.text) as { items?: string[] };
        for (const ik of dj.items ?? []) {
          const loc = snap.items[ik];
          if (loc && !loc.synced) {
            loc.conflict = true;
            skippedConflicts++;
            continue;
          }
          delete snap.items[ik];
          deleted++;
        }
      } catch {
        //
      }
    }
    if (delRes.lastModifiedVersion != null) {
      maxLibVer = Math.max(maxLibVer, delRes.lastModifiedVersion);
    }
    if (topRes.lastModifiedVersion != null) {
      maxLibVer = Math.max(maxLibVer, topRes.lastModifiedVersion);
    }
    if (allRes.lastModifiedVersion != null) {
      maxLibVer = Math.max(maxLibVer, allRes.lastModifiedVersion);
    }
    snap.libraryVersion = maxLibVer;

    return { snap, downloaded, deleted, skippedConflicts };
  }
}

function applyRemoteEnvelope(
  snap: ZoteroStoreSnapshot,
  env: ZoteroApiItemEnvelope
): void {
  const existing = snap.items[env.key];
  if (existing && !existing.synced) {
    existing.conflict = true;
    return;
  }
  const rec: StoredZoteroItem = {
    key: env.key,
    version: env.version,
    synced: true,
    data: env.data ?? {},
    conflict: false,
  };
  snap.items[env.key] = rec;
  snap.retryFetchKeys = snap.retryFetchKeys.filter((k) => k !== env.key);
}

export function noticeSyncResult(r: SyncResult, t: (s: string) => string) {
  if (!r.ok) {
    new Notice(t('Zotero sync failed') + (r.error ? `: ${r.error}` : ''));
    return;
  }
  new Notice(
    `${t('Zotero sync done')}: +${r.downloaded} ↓ / ${r.uploaded} ↑ / −${r.deleted} ⊘` +
      (r.skippedConflicts
        ? ` (${r.skippedConflicts} ${t('conflicts skipped')})`
        : '')
  );
}
