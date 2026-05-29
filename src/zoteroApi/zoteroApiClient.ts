import { requestUrl } from 'obsidian';

import type { ZoteroKeysCurrentResponse } from './types';

export const ZOTERO_API_BASE = 'https://api.zotero.org';

export function readLastModifiedVersion(
  headers: Record<string, string | undefined> | null | undefined
): number | undefined {
  if (!headers) return undefined;
  const raw =
    headers['last-modified-version'] ??
    headers['Last-Modified-Version'] ??
    headers['Last-Modified-version'];
  if (raw === undefined || raw === '') return undefined;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : undefined;
}

export interface ZoteroClientOptions {
  apiKey: string;
}

export class ZoteroApiClient {
  constructor(private opts: ZoteroClientOptions) {}

  setApiKey(key: string) {
    this.opts = { apiKey: key };
  }

  private baseHeaders(
    extra?: Record<string, string>,
    ifModifiedSinceVersion?: number,
    ifUnmodifiedSinceVersion?: number
  ): Record<string, string> {
    const h: Record<string, string> = {
      'Zotero-API-Key': this.opts.apiKey,
      'Zotero-API-Version': '3',
      ...extra,
    };
    if (ifModifiedSinceVersion !== undefined) {
      h['If-Modified-Since-Version'] = String(ifModifiedSinceVersion);
    }
    if (ifUnmodifiedSinceVersion !== undefined) {
      h['If-Unmodified-Since-Version'] = String(ifUnmodifiedSinceVersion);
    }
    return h;
  }

  async request(
    path: string,
    init?: {
      method?: string;
      body?: string | ArrayBuffer;
      contentType?: string;
      ifModifiedSinceVersion?: number;
      ifUnmodifiedSinceVersion?: number;
      extraHeaders?: Record<string, string>;
    }
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    text: string;
    lastModifiedVersion?: number;
  }> {
    const url = path.startsWith('http')
      ? path
      : `${ZOTERO_API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers = {
      ...this.baseHeaders(
        init?.contentType ? { 'Content-Type': init.contentType } : undefined,
        init?.ifModifiedSinceVersion,
        init?.ifUnmodifiedSinceVersion
      ),
      ...init?.extraHeaders,
    };

    const res = await requestUrl({
      url,
      method: init?.method ?? 'GET',
      headers,
      body: init?.body,
      throw: false,
    });

    const outHeaders: Record<string, string> = {};
    if (res.headers) {
      for (const [k, v] of Object.entries(res.headers)) {
        outHeaders[k.toLowerCase()] = String(v);
      }
    }

    const lastModifiedVersion = readLastModifiedVersion(outHeaders as any);

    return {
      status: res.status,
      headers: outHeaders,
      text: typeof res.text === 'string' ? res.text : String(res.text ?? ''),
      lastModifiedVersion,
    };
  }

  async getJson<T = unknown>(
    path: string,
    opts?: {
      ifModifiedSinceVersion?: number;
      ifUnmodifiedSinceVersion?: number;
    }
  ): Promise<{
    status: number;
    json: T | null;
    lastModifiedVersion?: number;
    text: string;
  }> {
    const res = await this.request(path, {
      ifModifiedSinceVersion: opts?.ifModifiedSinceVersion,
      ifUnmodifiedSinceVersion: opts?.ifUnmodifiedSinceVersion,
    });
    if (res.status === 304 || res.status === 204 || !res.text?.length) {
      return {
        status: res.status,
        json: null,
        lastModifiedVersion: res.lastModifiedVersion,
        text: res.text,
      };
    }
    try {
      return {
        status: res.status,
        json: JSON.parse(res.text) as T,
        lastModifiedVersion: res.lastModifiedVersion,
        text: res.text,
      };
    } catch {
      return {
        status: res.status,
        json: null,
        lastModifiedVersion: res.lastModifiedVersion,
        text: res.text,
      };
    }
  }

  async keysCurrent(): Promise<ZoteroKeysCurrentResponse | null> {
    const res = await this.getJson<ZoteroKeysCurrentResponse>('/keys/current');
    if (res.status !== 200 || !res.json) return null;
    return res.json;
  }

  async patchItem(
    prefix: string,
    itemKey: string,
    itemVersion: number,
    jsonBody: string
  ): Promise<{
    status: number;
    text: string;
    lastModifiedVersion?: number;
  }> {
    const path = `${prefix}/items/${itemKey}`;
    const res = await this.request(path, {
      method: 'PATCH',
      body: jsonBody,
      contentType: 'application/json',
      ifUnmodifiedSinceVersion: itemVersion,
    });
    return {
      status: res.status,
      text: res.text,
      lastModifiedVersion: res.lastModifiedVersion,
    };
  }

  /** Création d’objets (ex. pièce jointe enfant) — `If-Unmodified-Since-Version` = version bibliothèque. */
  async postItems(
    prefix: string,
    libraryVersion: number,
    jsonBody: string
  ): Promise<{
    status: number;
    text: string;
    lastModifiedVersion?: number;
  }> {
    const path = `${prefix}/items`;
    const res = await this.request(path, {
      method: 'POST',
      body: jsonBody,
      contentType: 'application/json',
      ifUnmodifiedSinceVersion: libraryVersion,
    });
    return {
      status: res.status,
      text: res.text,
      lastModifiedVersion: res.lastModifiedVersion,
    };
  }

  async deleteItem(
    prefix: string,
    itemKey: string,
    itemVersion: number
  ): Promise<{
    status: number;
    text: string;
    lastModifiedVersion?: number;
  }> {
    const path = `${prefix}/items/${itemKey}`;
    const res = await this.request(path, {
      method: 'DELETE',
      ifUnmodifiedSinceVersion: itemVersion,
    });
    return {
      status: res.status,
      text: res.text,
      lastModifiedVersion: res.lastModifiedVersion,
    };
  }

  /** Ajoute des items à une collection Zotero. */
  async postCollectionItems(
    prefix: string,
    collectionKey: string,
    libraryVersion: number,
    itemKeys: string[]
  ): Promise<{
    status: number;
    text: string;
    lastModifiedVersion?: number;
  }> {
    const body = JSON.stringify(itemKeys.map((key) => ({ key })));
    const path = `${prefix}/collections/${collectionKey}/items`;
    const res = await this.request(path, {
      method: 'POST',
      body,
      contentType: 'application/json',
      ifUnmodifiedSinceVersion: libraryVersion,
    });
    return {
      status: res.status,
      text: res.text,
      lastModifiedVersion: res.lastModifiedVersion,
    };
  }

  /** Autorisation d’upload pour pièce jointe `imported_file`. */
  async postItemFileAuthorization(
    prefix: string,
    itemKey: string,
    fields: {
      md5: string;
      filename: string;
      filesize: number;
      mtime: number;
    }
  ): Promise<{ status: number; text: string }> {
    const body = new URLSearchParams({
      md5: fields.md5,
      filename: fields.filename,
      filesize: String(fields.filesize),
      mtime: String(fields.mtime),
    }).toString();
    const path = `${prefix}/items/${itemKey}/file`;
    const res = await this.request(path, {
      method: 'POST',
      body,
      contentType: 'application/x-www-form-urlencoded',
      extraHeaders: { 'If-None-Match': '*' },
    });
    return { status: res.status, text: res.text };
  }

  async registerItemFileUpload(
    prefix: string,
    itemKey: string,
    uploadKey: string
  ): Promise<{ status: number; text: string; lastModifiedVersion?: number }> {
    const body = new URLSearchParams({ upload: uploadKey }).toString();
    const path = `${prefix}/items/${itemKey}/file`;
    const res = await this.request(path, {
      method: 'POST',
      body,
      contentType: 'application/x-www-form-urlencoded',
      extraHeaders: { 'If-None-Match': '*' },
    });
    return {
      status: res.status,
      text: res.text,
      lastModifiedVersion: res.lastModifiedVersion,
    };
  }

  /** POST multipart (prefix + fichier + suffix) vers l’URL S3 de Zotero. */
  async uploadFilePayload(
    url: string,
    contentType: string,
    body: ArrayBuffer
  ): Promise<{ status: number }> {
    const res = await requestUrl({
      url,
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
      throw: false,
    });
    return { status: res.status };
  }
}

/** API envelope for one item */
export interface ZoteroApiItemEnvelope {
  key: string;
  version: number;
  data: Record<string, unknown>;
}

export function parseItemArray(body: string): ZoteroApiItemEnvelope[] {
  try {
    const j = JSON.parse(body) as unknown;
    if (Array.isArray(j)) return j;
    if (j && typeof j === 'object' && 'key' in (j as object)) {
      return [j as ZoteroApiItemEnvelope];
    }
    return [];
  } catch {
    return [];
  }
}
