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
      body?: string;
      contentType?: string;
      ifModifiedSinceVersion?: number;
      ifUnmodifiedSinceVersion?: number;
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
    const headers = this.baseHeaders(
      init?.contentType ? { 'Content-Type': init.contentType } : undefined,
      init?.ifModifiedSinceVersion,
      init?.ifUnmodifiedSinceVersion
    );

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
