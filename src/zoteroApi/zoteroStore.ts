import { normalizePath } from 'obsidian';
import type { App } from 'obsidian';

import type { ZoteroStoreSnapshot } from './types';

const STORE_DIR = '.pandoc';

export function libraryCacheFileId(
  userId: number,
  libraryType: 'user' | 'group',
  groupId?: number
): string {
  if (libraryType === 'group' && groupId != null) {
    return `zotero-api-group-${groupId}`;
  }
  return `zotero-api-user-${userId}`;
}

export function getStoreVaultPath(fileId: string): string {
  return normalizePath(`${STORE_DIR}/${fileId}.json`);
}

function emptySnapshot(): ZoteroStoreSnapshot {
  return {
    libraryVersion: 0,
    items: {},
    pendingDeleteKeys: [],
    retryFetchKeys: [],
  };
}

export class ZoteroStore {
  constructor(private app: App) {}

  async ensureDir(): Promise<void> {
    const dir = normalizePath(STORE_DIR);
    if (this.app.vault.getAbstractFileByPath(dir)) {
      return;
    }
    try {
      await this.app.vault.createFolder(dir);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Parallel saves can race; Obsidian throws if the folder was just created.
      if (/already exists/i.test(msg)) {
        return;
      }
      if (this.app.vault.getAbstractFileByPath(dir)) {
        return;
      }
      throw e;
    }
  }

  async load(fileId: string): Promise<ZoteroStoreSnapshot> {
    const path = getStoreVaultPath(fileId);
    const exists = await this.app.vault.adapter.exists(path);
    if (!exists) return emptySnapshot();
    try {
      const raw = await this.app.vault.adapter.read(path);
      const parsed = JSON.parse(raw) as ZoteroStoreSnapshot;
      if (!parsed || typeof parsed.libraryVersion !== 'number') {
        return emptySnapshot();
      }
      parsed.items = parsed.items ?? {};
      parsed.pendingDeleteKeys = parsed.pendingDeleteKeys ?? [];
      parsed.retryFetchKeys = parsed.retryFetchKeys ?? [];
      return parsed;
    } catch {
      return emptySnapshot();
    }
  }

  async save(fileId: string, data: ZoteroStoreSnapshot): Promise<void> {
    await this.ensureDir();
    const path = getStoreVaultPath(fileId);
    await this.app.vault.adapter.write(path, JSON.stringify(data));
  }
}
