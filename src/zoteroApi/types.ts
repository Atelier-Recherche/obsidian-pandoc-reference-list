/** Local persisted record for one Zotero item */
export interface StoredZoteroItem {
  key: string;
  version: number;
  synced: boolean;
  /** Editable Zotero item fields (API `data` block) */
  data: Record<string, unknown>;
  /** True when remote changed but local had unsynced edits — needs user resolution */
  conflict?: boolean;
}

export interface ZoteroStoreSnapshot {
  libraryVersion: number;
  items: Record<string, StoredZoteroItem>;
  pendingDeleteKeys: string[];
  retryFetchKeys: string[];
}

export type ZoteroKeysCurrentResponse = {
  userID: number;
  username?: string;
  access?: Record<string, unknown>;
};

export interface ZoteroDeletedResponse {
  collections: string[];
  searches: string[];
  items: string[];
  tags?: string[];
}

export interface SyncResult {
  ok: boolean;
  libraryVersion: number;
  downloaded: number;
  uploaded: number;
  deleted: number;
  skippedConflicts: number;
  error?: string;
}
