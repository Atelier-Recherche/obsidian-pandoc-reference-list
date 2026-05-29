import type ReferenceList from 'src/main';
import { Notice } from 'obsidian';

import { md5Hex } from './fileHash';
import { normalizeWebHref, pathForZoteroLinkedFileStorage } from './attachmentLinks';

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
import { mergeUserAndGroupSnapshots, parseStorageItemKey } from './zoteroMerge';
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

/** Clé item API (8 car. alphanum. — format Zotero base32, validation simple). */
const ZOTERO_ITEM_KEY_RE = /^[0-9A-Z]{8}$/i;

function isZoteroItemKeyString(s: string): boolean {
  return ZOTERO_ITEM_KEY_RE.test(s.trim());
}

/**
 * Clés créées par POST /items : la doc utilise `successful` ou parfois `success`.
 * Les valeurs peuvent être la clé string ou des objets avec erreur dans `failed`.
 */
function extractNewItemKeysFromWriteResponse(text: string): string[] {
  if (!text?.trim()) return [];
  const out: string[] = [];
  try {
    const j = JSON.parse(text) as {
      successful?: Record<string, unknown>;
      success?: Record<string, unknown>;
    };
    const bucket = j.successful ?? j.success;
    if (bucket && typeof bucket === 'object') {
      for (const v of Object.values(bucket)) {
        if (typeof v === 'string') {
          const s = v.trim();
          if (s && isZoteroItemKeyString(s)) out.push(s.toUpperCase());
        } else if (v && typeof v === 'object' && v !== null && 'key' in v) {
          const k = (v as { key?: unknown }).key;
          if (typeof k === 'string' && isZoteroItemKeyString(k)) {
            out.push(k.trim().toUpperCase());
          }
        }
      }
    }
  } catch {
    //
  }
  if (out.length) return out;

  const idx = text.search(/"(?:successful|success)"\s*:/i);
  const slice = idx >= 0 ? text.slice(idx, idx + 4000) : text;
  const quoted = slice.matchAll(/"([0-9A-Z]{8})"/gi);
  for (const m of quoted) {
    const k = m[1].toUpperCase();
    if (!out.includes(k)) out.push(k);
    if (out.length >= 3) break;
  }
  return out;
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

  /**
   * Bibliothèques de groupe accessibles avec la clé API (`GET /users/{userID}/groups`).
   */
  async fetchGroupLibraries(): Promise<{ id: number; name: string }[]> {
    this.updateApiKey();
    const uid = this.plugin.settings.zoteroApiUserId;
    if (uid == null) return [];
    const res = await this.client.request(`/users/${uid}/groups?format=json`);
    if (res.status !== 200 || !res.text?.trim()) return [];
    try {
      const raw = JSON.parse(res.text) as unknown;
      if (!Array.isArray(raw)) return [];
      const out: { id: number; name: string }[] = [];
      for (const row of raw) {
        if (!row || typeof row !== 'object') continue;
        const o = row as {
          library?: { type?: string; id?: number };
          data?: { name?: string; groupID?: number };
        };
        let gid: number | undefined;
        if (o.library?.type === 'group' && typeof o.library.id === 'number') {
          gid = o.library.id;
        } else if (
          typeof o.data?.groupID === 'number' &&
          Number.isFinite(o.data.groupID)
        ) {
          gid = o.data.groupID;
        }
        if (gid === undefined) continue;
        const name =
          typeof o.data?.name === 'string' && o.data.name.trim()
            ? o.data.name.trim()
            : `Group ${gid}`;
        out.push({ id: gid, name });
      }
      out.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );
      return out;
    } catch {
      return [];
    }
  }

  /** IDs groupes fusion depuis les réglages (dédoublonnés). */
  private normalizedMergeGroupIds(): number[] {
    const raw = this.plugin.settings.zoteroApiMergeGroupIds;
    if (!raw?.length) return [];
    const seen = new Set<number>();
    const out: number[] = [];
    for (const x of raw) {
      const n =
        typeof x === 'number' ? x : parseInt(String(x).trim(), 10);
      if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    return out;
  }

  /** Pour le panneau / synchro secondaire (même ordre que {@link loadSnapshot}). */
  mergeGroupIdsResolved(): number[] {
    return this.normalizedMergeGroupIds();
  }

  /** Fichier JSON courant selon les réglages (utilisateur ou groupe principal uniquement). */
  async loadPrimarySnapshot(): Promise<ZoteroStoreSnapshot> {
    return this.store.load(this.getFileId());
  }

  async savePrimarySnapshot(snap: ZoteroStoreSnapshot): Promise<void> {
    await this.store.save(this.getFileId(), snap);
  }

  async saveSnapshotFile(
    fileId: string,
    snap: ZoteroStoreSnapshot
  ): Promise<void> {
    await this.store.save(fileId, snap);
  }

  /** Cache disque du groupe (sans fusion) — pour une section dédiée dans le panneau. */
  async loadRawGroupSnapshot(groupId: number): Promise<ZoteroStoreSnapshot> {
    const uid = this.plugin.settings.zoteroApiUserId ?? 0;
    return this.store.load(libraryCacheFileId(uid, 'group', groupId));
  }

  /**
   * Vue utilisée par le panneau, les infobulles et la bib. : fusion bib. perso + groupe optionnel.
   */
  async loadSnapshot(): Promise<ZoteroStoreSnapshot> {
    const primary = await this.loadPrimarySnapshot();
    const s = this.plugin.settings;
    const ids = this.normalizedMergeGroupIds();
    if (s.zoteroApiLibraryType !== 'user' || ids.length === 0) {
      return primary;
    }
    const uid = s.zoteroApiUserId ?? 0;
    let merged = primary;
    for (const gid of ids) {
      const groupSnap = await this.store.load(
        libraryCacheFileId(uid, 'group', gid)
      );
      merged = mergeUserAndGroupSnapshots(merged, groupSnap, gid);
    }
    return merged;
  }

  private getWriteRoute(itemKey: string): {
    fileId: string;
    prefix: string;
    plainKey: string;
    /** Si défini, il faut lancer `sync` avec la bib. de ce groupe */
    syncAsGroupId?: number;
  } {
    const parsed = parseStorageItemKey(itemKey);
    const s = this.plugin.settings;
    const uid = s.zoteroApiUserId ?? 0;
    if (parsed.scope === 'group') {
      return {
        fileId: libraryCacheFileId(uid, 'group', parsed.groupId),
        prefix: `/groups/${parsed.groupId}`,
        plainKey: parsed.plainKey,
        syncAsGroupId: parsed.groupId,
      };
    }
    if (s.zoteroApiLibraryType === 'group' && s.zoteroApiGroupId != null) {
      return {
        fileId: libraryCacheFileId(uid, 'group', s.zoteroApiGroupId),
        prefix: `/groups/${s.zoteroApiGroupId}`,
        plainKey: parsed.plainKey,
        syncAsGroupId: s.zoteroApiGroupId,
      };
    }
    return {
      fileId: libraryCacheFileId(uid, 'user'),
      prefix: `/users/${uid}`,
      plainKey: parsed.plainKey,
    };
  }

  private apiKeyForWrite(it: StoredZoteroItem, plainKey: string): string {
    const dk = it.data?.key;
    if (typeof dk === 'string' && dk.trim()) return dk.trim();
    return plainKey;
  }

  /** Noms des dossiers Zotero (collections) pour l’arborescence du panneau */
  async fetchCollectionNames(): Promise<Map<string, string>> {
    this.updateApiKey();
    const map = await this.fetchCollectionNamesForPrefix(this.getLibraryPrefix());
    const s = this.plugin.settings;
    const mergeIds = this.normalizedMergeGroupIds();
    const cache = s.zoteroApiGroupNamesCache ?? {};
    if (s.zoteroApiLibraryType === 'user' && mergeIds.length) {
      for (const gid of mergeIds) {
        const groupMap = await this.fetchCollectionNamesForPrefix(
          `/groups/${gid}`
        );
        const collP = `g${gid}_c_`;
        const custom = s.zoteroApiMergeGroupLabels?.[String(gid)]?.trim();
        const glabel = custom || cache[String(gid)]?.trim() || `${gid}`;
        for (const [k, name] of groupMap) {
          map.set(`${collP}${k}`, `${glabel} — ${name}`);
        }
      }
    }
    return map;
  }

  private async fetchCollectionNamesForPrefix(
    prefix: string
  ): Promise<Map<string, string>> {
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
    const route = this.getWriteRoute(itemKey);
    const snap = await this.store.load(route.fileId);
    const it = snap.items[route.plainKey];
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
    if (
      String(merged.linkMode ?? '') === 'linked_file' &&
      typeof merged.path === 'string'
    ) {
      merged.path = pathForZoteroLinkedFileStorage(merged.path);
    }
    const apiKey = this.apiKeyForWrite(it, route.plainKey);
    /** PATCH /items/{key} attend un objet partiel, pas un tableau (sinon 400). */
    const body = JSON.stringify({
      ...merged,
      key: apiKey,
      version: it.version,
    });
    const res = await this.client.patchItem(
      route.prefix,
      apiKey,
      it.version,
      body
    );

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
        `${route.prefix}/items/${apiKey}?format=json&includeTrashed=1`
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

    snap.items[route.plainKey] = {
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
    await this.saveSnapshotFile(route.fileId, snap);
    return { ok: true };
  }

  /**
   * Crée une pièce jointe enfant : lien web (`linked_url`) ou fichier lié (`linked_file`, chemin absolu).
   */
  async createChildAttachment(
    parentKey: string,
    spec: {
      linkMode: 'linked_url' | 'linked_file';
      title: string;
      url?: string;
      path?: string;
    }
  ): Promise<{ ok: boolean; error?: string }> {
    this.updateApiKey();
    const route = this.getWriteRoute(parentKey);
    let snap = await this.store.load(route.fileId);
    const parent = snap.items[route.plainKey];
    if (!parent) {
      return { ok: false, error: 'not_found' };
    }
    if (String(parent.data.itemType) === 'attachment') {
      return { ok: false, error: 'parent_is_attachment' };
    }

    const newData: Record<string, unknown> = {
      itemType: 'attachment',
      linkMode: spec.linkMode,
      parentItem: route.plainKey,
      title: spec.title.trim() || 'Attachment',
    };
    if (spec.linkMode === 'linked_url') {
      const u = normalizeWebHref(spec.url?.trim() ?? '');
      if (!/^https?:\/\//i.test(u)) {
        return { ok: false, error: 'url_required' };
      }
      newData.url = u;
    } else {
      const p = pathForZoteroLinkedFileStorage(spec.path?.trim() ?? '');
      if (!p) {
        return { ok: false, error: 'path_required' };
      }
      newData.path = p;
      const lower = p.toLowerCase();
      newData.contentType = lower.endsWith('.pdf')
        ? 'application/pdf'
        : 'application/octet-stream';
    }

    const body = JSON.stringify([newData]);
    const libVerBeforePost = snap.libraryVersion;
    let res = await this.client.postItems(
      route.prefix,
      snap.libraryVersion,
      body
    );

    /** 412 = version bibliothèque locale dépassée — tirage incrémental puis un nouveau POST (doc Zotero). */
    for (let r412 = 0; res.status === 412 && r412 < 2; r412++) {
      const pull = await this.pullIncremental(route.prefix, route.fileId);
      await this.saveSnapshotFile(route.fileId, pull.snap);
      snap = await this.store.load(route.fileId);
      res = await this.client.postItems(
        route.prefix,
        snap.libraryVersion,
        body
      );
    }

    if (res.status === 412) {
      return { ok: false, error: '412' };
    }
    if (res.status < 200 || res.status >= 300) {
      let detail = `http_${res.status}`;
      try {
        const j = JSON.parse(res.text) as {
          failed?: Record<string, { message?: string }>;
        };
        const f = j.failed && Object.values(j.failed)[0];
        if (f && typeof f.message === 'string') detail = f.message;
      } catch {
        //
      }
      return { ok: false, error: detail };
    }

    try {
      const written = JSON.parse(res.text) as {
        failed?: Record<string, { code?: number; message?: string }>;
      };
      if (written.failed && Object.keys(written.failed).length > 0) {
        const f = Object.values(written.failed)[0];
        const msg =
          f && typeof f.message === 'string' && f.message.trim()
            ? f.message.trim()
            : 'write_failed';
        return { ok: false, error: msg };
      }
    } catch {
      //
    }

    const newKeys = extractNewItemKeysFromWriteResponse(res.text);
    const newKey = newKeys[0];

    let mergedOk = false;
    if (newKey) {
      mergedOk = await this.fetchAndOverwriteItemPlain(
        newKey,
        route.prefix,
        route.fileId
      );
    }

    if (!mergedOk) {
      const sRewind = await this.store.load(route.fileId);
      sRewind.libraryVersion = libVerBeforePost;
      await this.saveSnapshotFile(route.fileId, sRewind);
      await this.syncRewindFallback(route.syncAsGroupId);
    }

    const sFinal = await this.store.load(route.fileId);
    if (res.lastModifiedVersion != null) {
      sFinal.libraryVersion = Math.max(
        sFinal.libraryVersion,
        res.lastModifiedVersion
      );
    }
    await this.saveSnapshotFile(route.fileId, sFinal);

    if (newKey && !sFinal.items[newKey]) {
      return { ok: false, error: 'created_but_not_in_snapshot' };
    }

    return { ok: true };
  }

  private getDefaultWriteRoute(): {
    fileId: string;
    prefix: string;
    syncAsGroupId?: number;
  } {
    const s = this.plugin.settings;
    const uid = s.zoteroApiUserId ?? 0;
    if (s.zoteroApiLibraryType === 'group' && s.zoteroApiGroupId != null) {
      return {
        fileId: libraryCacheFileId(uid, 'group', s.zoteroApiGroupId),
        prefix: `/groups/${s.zoteroApiGroupId}`,
        syncAsGroupId: s.zoteroApiGroupId,
      };
    }
    return {
      fileId: libraryCacheFileId(uid, 'user'),
      prefix: `/users/${uid}`,
    };
  }

  private parsePostItemsError(text: string, status: number): string {
    let detail = `http_${status}`;
    try {
      const j = JSON.parse(text) as {
        failed?: Record<string, { message?: string }>;
      };
      const f = j.failed && Object.values(j.failed)[0];
      if (f && typeof f.message === 'string') detail = f.message;
    } catch {
      //
    }
    return detail;
  }

  private async postItemsWithRetry(
    route: ReturnType<ZoteroSyncService['getDefaultWriteRoute']>,
    items: Record<string, unknown>[]
  ): Promise<{
    ok: boolean;
    keys: string[];
    error?: string;
    lastModifiedVersion?: number;
  }> {
    this.updateApiKey();
    let snap = await this.store.load(route.fileId);
    const body = JSON.stringify(items);
    const libVerBeforePost = snap.libraryVersion;
    let res = await this.client.postItems(route.prefix, snap.libraryVersion, body);

    for (let r412 = 0; res.status === 412 && r412 < 2; r412++) {
      const pull = await this.pullIncremental(route.prefix, route.fileId);
      await this.saveSnapshotFile(route.fileId, pull.snap);
      snap = await this.store.load(route.fileId);
      res = await this.client.postItems(route.prefix, snap.libraryVersion, body);
    }

    if (res.status === 412) return { ok: false, keys: [], error: '412' };
    if (res.status < 200 || res.status >= 300) {
      return {
        ok: false,
        keys: [],
        error: this.parsePostItemsError(res.text, res.status),
      };
    }

    try {
      const written = JSON.parse(res.text) as {
        failed?: Record<string, { code?: number; message?: string }>;
      };
      if (written.failed && Object.keys(written.failed).length > 0) {
        const f = Object.values(written.failed)[0];
        const msg =
          f && typeof f.message === 'string' && f.message.trim()
            ? f.message.trim()
            : 'write_failed';
        return { ok: false, keys: [], error: msg };
      }
    } catch {
      //
    }

    const keys = extractNewItemKeysFromWriteResponse(res.text);
    for (const key of keys) {
      await this.fetchAndOverwriteItemPlain(key, route.prefix, route.fileId);
    }

    if (!keys.length) {
      const sRewind = await this.store.load(route.fileId);
      sRewind.libraryVersion = libVerBeforePost;
      await this.saveSnapshotFile(route.fileId, sRewind);
      await this.syncRewindFallback(route.syncAsGroupId);
    }

    const sFinal = await this.store.load(route.fileId);
    if (res.lastModifiedVersion != null) {
      sFinal.libraryVersion = Math.max(
        sFinal.libraryVersion,
        res.lastModifiedVersion
      );
    }
    await this.saveSnapshotFile(route.fileId, sFinal);

    return { ok: true, keys, lastModifiedVersion: res.lastModifiedVersion };
  }

  /** Crée un item catalogue (livre, document, etc.) sans parent. */
  async createTopLevelItem(spec: {
    itemType?: string;
    title: string;
    creators?: Record<string, unknown>[];
    citationKey?: string;
  }): Promise<{ ok: boolean; key?: string; error?: string }> {
    const route = this.getDefaultWriteRoute();
    const creators = normalizeCreatorsArrayForWrite(spec.creators ?? []);
    const data: Record<string, unknown> = {
      itemType: spec.itemType?.trim() || 'book',
      title: spec.title.trim() || 'Untitled',
    };
    if (creators?.length) data.creators = creators;
    const ck = spec.citationKey?.trim();
    if (ck) data.citationKey = ck;

    const posted = await this.postItemsWithRetry(route, [data]);
    if (!posted.ok || !posted.keys[0]) {
      return { ok: false, error: posted.error ?? 'no_key' };
    }
    return { ok: true, key: posted.keys[0] };
  }

  /** Route API pour une clé collection (y compris préfixe fusion groupe). */
  collectionRouteForStorageKey(storageCollectionKey: string): {
    prefix: string;
    collectionKey: string;
    fileId: string;
    syncAsGroupId?: number;
  } {
    const m = storageCollectionKey.match(/^g(\d+)_c_(.+)$/);
    if (m) {
      const gid = parseInt(m[1], 10);
      const uid = this.plugin.settings.zoteroApiUserId ?? 0;
      return {
        prefix: `/groups/${gid}`,
        collectionKey: m[2],
        fileId: libraryCacheFileId(uid, 'group', gid),
        syncAsGroupId: gid,
      };
    }
    const base = this.getDefaultWriteRoute();
    return {
      prefix: base.prefix,
      collectionKey: storageCollectionKey,
      fileId: base.fileId,
      syncAsGroupId: base.syncAsGroupId,
    };
  }

  async addItemToCollection(
    storageCollectionKey: string,
    itemKey: string
  ): Promise<{ ok: boolean; error?: string }> {
    if (!storageCollectionKey.trim()) return { ok: true };
    this.updateApiKey();
    const collRoute = this.collectionRouteForStorageKey(storageCollectionKey);
    const itemRoute = this.getWriteRoute(itemKey);
    const plainItemKey =
      itemRoute.plainKey !== itemKey
        ? itemRoute.plainKey
        : parseStorageItemKey(itemKey).plainKey;

    let snap = await this.store.load(collRoute.fileId);
    let res = await this.client.postCollectionItems(
      collRoute.prefix,
      collRoute.collectionKey,
      snap.libraryVersion,
      [plainItemKey]
    );

    for (let r412 = 0; res.status === 412 && r412 < 2; r412++) {
      const pull = await this.pullIncremental(collRoute.prefix, collRoute.fileId);
      await this.saveSnapshotFile(collRoute.fileId, pull.snap);
      snap = await this.store.load(collRoute.fileId);
      res = await this.client.postCollectionItems(
        collRoute.prefix,
        collRoute.collectionKey,
        snap.libraryVersion,
        [plainItemKey]
      );
    }

    if (res.status === 412) return { ok: false, error: '412' };
    if (res.status < 200 || res.status >= 300) {
      return { ok: false, error: `http_${res.status}` };
    }

    if (res.lastModifiedVersion != null) {
      snap.libraryVersion = Math.max(
        snap.libraryVersion,
        res.lastModifiedVersion
      );
      await this.saveSnapshotFile(collRoute.fileId, snap);
    }
    return { ok: true };
  }

  /** Pièce jointe `imported_file` avec upload du binaire vers Zotero. */
  async uploadImportedFileAttachment(
    parentKey: string,
    spec: { title: string; filename: string; bytes: Uint8Array; mtimeMs?: number }
  ): Promise<{ ok: boolean; key?: string; error?: string }> {
    const route = this.getWriteRoute(parentKey);
    const parent = (await this.store.load(route.fileId)).items[route.plainKey];
    if (!parent) return { ok: false, error: 'not_found' };

    const filename = spec.filename.trim() || 'file.pdf';
    const attachmentData: Record<string, unknown> = {
      itemType: 'attachment',
      linkMode: 'imported_file',
      parentItem: route.plainKey,
      title: spec.title.trim() || filename,
      filename,
      contentType: 'application/pdf',
    };

    const posted = await this.postItemsWithRetry(route, [attachmentData]);
    if (!posted.ok || !posted.keys[0]) {
      return { ok: false, error: posted.error ?? 'attachment_create_failed' };
    }
    const attachKey = posted.keys[0];

    const hash = md5Hex(spec.bytes);
    if (!hash) return { ok: false, error: 'md5_unavailable' };

    const mtime = spec.mtimeMs ?? Date.now();
    const auth = await this.client.postItemFileAuthorization(route.prefix, attachKey, {
      md5: hash,
      filename,
      filesize: spec.bytes.byteLength,
      mtime,
    });

    if (auth.status < 200 || auth.status >= 300) {
      return { ok: false, error: `upload_auth_${auth.status}` };
    }

    let uploadInfo: {
      exists?: number;
      url?: string;
      contentType?: string;
      prefix?: string;
      suffix?: string;
      uploadKey?: string;
    };
    try {
      uploadInfo = JSON.parse(auth.text) as typeof uploadInfo;
    } catch {
      return { ok: false, error: 'upload_auth_parse' };
    }

    if (uploadInfo.exists === 1) {
      return { ok: true, key: attachKey };
    }

    if (
      !uploadInfo.url ||
      !uploadInfo.contentType ||
      uploadInfo.prefix == null ||
      uploadInfo.suffix == null ||
      !uploadInfo.uploadKey
    ) {
      return { ok: false, error: 'upload_auth_incomplete' };
    }

    const enc = new TextEncoder();
    const prefixBytes = enc.encode(uploadInfo.prefix);
    const suffixBytes = enc.encode(uploadInfo.suffix);
    const payload = new Uint8Array(
      prefixBytes.length + spec.bytes.length + suffixBytes.length
    );
    payload.set(prefixBytes, 0);
    payload.set(spec.bytes, prefixBytes.length);
    payload.set(suffixBytes, prefixBytes.length + spec.bytes.length);

    const up = await this.client.uploadFilePayload(
      uploadInfo.url,
      uploadInfo.contentType,
      payload.buffer
    );
    if (up.status !== 200 && up.status !== 201) {
      return { ok: false, error: `upload_post_${up.status}` };
    }

    const reg = await this.client.registerItemFileUpload(
      route.prefix,
      attachKey,
      uploadInfo.uploadKey
    );
    if (reg.status !== 204 && (reg.status < 200 || reg.status >= 300)) {
      return { ok: false, error: `upload_register_${reg.status}` };
    }

    await this.fetchAndOverwriteItemPlain(attachKey, route.prefix, route.fileId);
    return { ok: true, key: attachKey };
  }

  async importVaultPdfAsZoteroItem(spec: {
    title: string;
    creators?: Record<string, unknown>[];
    citationKey?: string;
    itemType?: string;
    attachmentMode: 'link' | 'upload';
    vaultPath: string;
    absolutePath: string;
    fileBytes?: Uint8Array;
    mtimeMs?: number;
    collectionStorageKey?: string;
  }): Promise<{ ok: boolean; parentKey?: string; error?: string }> {
    const parent = await this.createTopLevelItem({
      itemType: spec.itemType,
      title: spec.title,
      creators: spec.creators,
      citationKey: spec.citationKey,
    });
    if (!parent.ok || !parent.key) {
      return { ok: false, error: parent.error ?? 'parent_failed' };
    }

    let attachOk = false;
    if (spec.attachmentMode === 'upload') {
      if (!spec.fileBytes) {
        return { ok: false, error: 'bytes_required', parentKey: parent.key };
      }
      const baseName =
        spec.vaultPath.split(/[/\\]/).pop() ?? spec.title + '.pdf';
      const up = await this.uploadImportedFileAttachment(parent.key, {
        title: spec.title,
        filename: baseName,
        bytes: spec.fileBytes,
        mtimeMs: spec.mtimeMs,
      });
      attachOk = up.ok;
      if (!attachOk) {
        return { ok: false, error: up.error, parentKey: parent.key };
      }
    } else {
      const linked = await this.createChildAttachment(parent.key, {
        linkMode: 'linked_file',
        title: spec.title,
        path: spec.absolutePath,
      });
      attachOk = linked.ok;
      if (!attachOk) {
        return { ok: false, error: linked.error, parentKey: parent.key };
      }
    }

    if (spec.collectionStorageKey?.trim()) {
      const coll = await this.addItemToCollection(
        spec.collectionStorageKey,
        parent.key
      );
      if (!coll.ok) {
        return { ok: false, error: coll.error, parentKey: parent.key };
      }
    }

    return { ok: true, parentKey: parent.key };
  }

  /** Crée une annotation enfant d’une pièce jointe PDF. */
  async createAnnotation(
    parentAttachmentKey: string,
    fields: {
      annotationType?: string;
      annotationText?: string;
      annotationComment?: string;
      annotationColor?: string;
      annotationPageLabel?: string;
      annotationSortIndex?: string;
      annotationPosition: string;
    }
  ): Promise<{ ok: boolean; key?: string; error?: string }> {
    this.updateApiKey();
    const route = this.getWriteRoute(parentAttachmentKey);
    let snap = await this.store.load(route.fileId);
    const parent = snap.items[route.plainKey];
    if (!parent) return { ok: false, error: 'not_found' };
    if (String(parent.data.itemType) !== 'attachment') {
      return { ok: false, error: 'parent_not_attachment' };
    }

    const newData: Record<string, unknown> = {
      itemType: 'annotation',
      parentItem: route.plainKey,
      annotationType: fields.annotationType ?? 'highlight',
      annotationText: fields.annotationText ?? '',
      annotationComment: fields.annotationComment ?? '',
      annotationColor: fields.annotationColor ?? '#ffd400',
      annotationPageLabel: fields.annotationPageLabel ?? '',
      annotationSortIndex: fields.annotationSortIndex ?? '00000',
      annotationPosition: fields.annotationPosition,
    };

    const body = JSON.stringify([newData]);
    const libVerBeforePost = snap.libraryVersion;
    let res = await this.client.postItems(
      route.prefix,
      snap.libraryVersion,
      body
    );

    for (let r412 = 0; res.status === 412 && r412 < 2; r412++) {
      const pull = await this.pullIncremental(route.prefix, route.fileId);
      await this.saveSnapshotFile(route.fileId, pull.snap);
      snap = await this.store.load(route.fileId);
      res = await this.client.postItems(
        route.prefix,
        snap.libraryVersion,
        body
      );
    }

    if (res.status === 412) return { ok: false, error: '412' };
    if (res.status < 200 || res.status >= 300) {
      let detail = `http_${res.status}`;
      try {
        const j = JSON.parse(res.text) as {
          failed?: Record<string, { message?: string }>;
        };
        const f = j.failed && Object.values(j.failed)[0];
        if (f && typeof f.message === 'string') detail = f.message;
      } catch {
        //
      }
      return { ok: false, error: detail };
    }

    try {
      const written = JSON.parse(res.text) as {
        failed?: Record<string, { code?: number; message?: string }>;
      };
      if (written.failed && Object.keys(written.failed).length > 0) {
        const f = Object.values(written.failed)[0];
        const msg =
          f && typeof f.message === 'string' && f.message.trim()
            ? f.message.trim()
            : 'write_failed';
        return { ok: false, error: msg };
      }
    } catch {
      //
    }

    const newKeys = extractNewItemKeysFromWriteResponse(res.text);
    const newKey = newKeys[0];
    if (newKey) {
      await this.fetchAndOverwriteItemPlain(
        newKey,
        route.prefix,
        route.fileId
      );
    }

    const sFinal = await this.store.load(route.fileId);
    if (res.lastModifiedVersion != null) {
      sFinal.libraryVersion = Math.max(
        sFinal.libraryVersion,
        res.lastModifiedVersion
      );
    }
    await this.saveSnapshotFile(route.fileId, sFinal);

    if (route.syncAsGroupId != null) {
      await this.syncRewindFallback(route.syncAsGroupId);
    }

    return newKey ? { ok: true, key: newKey } : { ok: true };
  }

  /** Après POST raté à récupérer l’item : sync sur la bonne bib. (user vs groupe). */
  private async syncRewindFallback(syncAsGroupId?: number): Promise<void> {
    const s = this.plugin.settings;
    if (syncAsGroupId != null) {
      const bak = {
        lt: s.zoteroApiLibraryType,
        gid: s.zoteroApiGroupId,
      };
      s.zoteroApiLibraryType = 'group';
      s.zoteroApiGroupId = syncAsGroupId;
      try {
        await this.syncLibraryForCurrentSettings();
      } finally {
        s.zoteroApiLibraryType = bak.lt;
        s.zoteroApiGroupId = bak.gid;
      }
    } else {
      await this.syncLibraryForCurrentSettings();
    }
  }

  private async fetchAndOverwriteItemPlain(
    itemKeyPlain: string,
    prefix: string,
    fileId: string
  ): Promise<boolean> {
    this.updateApiKey();
    const res = await this.client.request(
      `${prefix}/items/${itemKeyPlain}?format=json&includeTrashed=1`
    );
    if (res.status !== 200) return false;
    const envelopes = parseItemArray(res.text) as ZoteroApiItemEnvelope[];
    const env = envelopes[0];
    if (!env?.data) return false;
    const snap = await this.store.load(fileId);
    snap.items[itemKeyPlain] = {
      key: env.key,
      version: env.version,
      synced: true,
      data: env.data,
      conflict: false,
    };
    await this.saveSnapshotFile(fileId, snap);
    return true;
  }

  /** Supprime un objet synchronisé (notice, pièce jointe, entrée catalogue, etc.). */
  async deleteLibraryItem(itemKey: string): Promise<{ ok: boolean; error?: string }> {
    this.updateApiKey();
    const route = this.getWriteRoute(itemKey);
    const snap = await this.store.load(route.fileId);
    const it = snap.items[route.plainKey];
    if (!it) return { ok: false, error: 'not_found' };

    const apiKey = this.apiKeyForWrite(it, route.plainKey);
    const res = await this.client.deleteItem(route.prefix, apiKey, it.version);
    if (res.status === 412) return { ok: false, error: '412' };
    if (res.status !== 204 && (res.status < 200 || res.status >= 300)) {
      return { ok: false, error: `http_${res.status}` };
    }

    const s = await this.store.load(route.fileId);
    delete s.items[route.plainKey];
    if (res.lastModifiedVersion != null) {
      s.libraryVersion = Math.max(s.libraryVersion, res.lastModifiedVersion);
    }
    await this.saveSnapshotFile(route.fileId, s);
    return { ok: true };
  }

  /** @deprecated Préférer {@link deleteLibraryItem} — conservé pour les appels existants. */
  async deleteAttachmentItem(itemKey: string): Promise<{ ok: boolean; error?: string }> {
    const route = this.getWriteRoute(itemKey);
    const snap = await this.store.load(route.fileId);
    const it = snap.items[route.plainKey];
    if (!it) return { ok: false, error: 'not_found' };
    if (String(it.data.itemType) !== 'attachment') {
      return { ok: false, error: 'not_attachment' };
    }
    return this.deleteLibraryItem(itemKey);
  }

  /** Apply remote copy when resolving a conflict */
  async fetchAndOverwriteItem(itemKey: string): Promise<boolean> {
    const route = this.getWriteRoute(itemKey);
    const snap = await this.store.load(route.fileId);
    const it = snap.items[route.plainKey];
    const apiKey = it
      ? this.apiKeyForWrite(it, route.plainKey)
      : route.plainKey;
    return this.fetchAndOverwriteItemPlain(apiKey, route.prefix, route.fileId);
  }

  async sync(): Promise<SyncResult> {
    let acc = await this.syncLibraryForCurrentSettings();
    if (!acc.ok) return acc;

    const s = this.plugin.settings;
    const mergeIds = this.normalizedMergeGroupIds();
    if (s.zoteroApiLibraryType !== 'user' || mergeIds.length === 0) {
      return acc;
    }

    const bakLt = s.zoteroApiLibraryType;
    const bakGid = s.zoteroApiGroupId;
    try {
      for (const mergeGid of mergeIds) {
        s.zoteroApiLibraryType = 'group';
        s.zoteroApiGroupId = mergeGid;
        const r2 = await this.syncLibraryForCurrentSettings();
        acc = {
          ok: acc.ok && r2.ok,
          libraryVersion: acc.libraryVersion,
          downloaded: acc.downloaded + r2.downloaded,
          uploaded: acc.uploaded + r2.uploaded,
          deleted: acc.deleted + r2.deleted,
          skippedConflicts: acc.skippedConflicts + r2.skippedConflicts,
          error: r2.ok ? acc.error : r2.error,
        };
        if (!r2.ok) break;
      }
      return acc;
    } finally {
      s.zoteroApiLibraryType = bakLt;
      s.zoteroApiGroupId = bakGid;
    }
  }

  /** Une passe de synchro pour la bibliothèque correspondant aux réglages courants (fichier JSON dédié). */
  private async syncLibraryForCurrentSettings(): Promise<SyncResult> {
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
      let snap = await this.loadPrimarySnapshot();

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

      await this.savePrimarySnapshot(snap);

      if (hit412) {
        const pull = await this.pullIncremental(prefix);
        downloaded += pull.downloaded;
        deleted += pull.deleted;
        skippedConflicts += pull.skippedConflicts;
        await this.savePrimarySnapshot(pull.snap);
        continue;
      }

      snap = await this.loadPrimarySnapshot();
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
        await this.savePrimarySnapshot(snap);
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

      await this.savePrimarySnapshot(snap);

      const stillDirty = Object.keys(snap.items).some(
        (k) => snap.items[k] && !snap.items[k].synced && !snap.items[k].conflict
      );
      if (!stillDirty && roundDl === 0) {
        break;
      }
    }

    const finalSnap = await this.loadPrimarySnapshot();
    return {
      ok: true,
      libraryVersion: finalSnap.libraryVersion,
      downloaded,
      uploaded,
      deleted,
      skippedConflicts,
    };
  }

  /**
   * Met à jour un fichier cache bibliothèque depuis `since=libraryVersion` (API Zotero).
   * @param fileId — défaut : bibliothèque active selon les réglages (voir {@link getFileId}).
   */
  private async pullIncremental(
    prefix: string,
    fileId?: string
  ): Promise<{
    snap: ZoteroStoreSnapshot;
    downloaded: number;
    deleted: number;
    skippedConflicts: number;
  }> {
    const fid = fileId ?? this.getFileId();
    const snap = await this.store.load(fid);
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
