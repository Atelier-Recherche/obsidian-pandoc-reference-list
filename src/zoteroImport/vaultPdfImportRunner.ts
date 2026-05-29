import { Platform } from 'obsidian';

import type ReferenceList from '../main';
import { resolveVaultPdfAbsolutePath } from '../zoteroApi/vaultPaths';
import { authorToCreators } from './metadataParser';
import type { VaultPdfImportRow } from './types';

export interface VaultPdfImportRunOptions {
  rows: VaultPdfImportRow[];
  collectionMainKey: string;
  collectionShortKey: string;
  shortPdfMaxPages: number;
  attachmentMode: 'link' | 'upload';
  itemType?: string;
  onProgress?: (done: number, total: number, current?: string) => void;
}

export interface VaultPdfImportRunResult {
  created: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export async function runVaultPdfImport(
  plugin: ReferenceList,
  opts: VaultPdfImportRunOptions
): Promise<VaultPdfImportRunResult> {
  const selected = opts.rows.filter((r) => r.selected && r.status === 'new');
  const result: VaultPdfImportRunResult = {
    created: 0,
    failed: 0,
    skipped: opts.rows.length - selected.length,
    errors: [],
  };

  if (opts.attachmentMode === 'link' && !Platform.isDesktopApp) {
    result.errors.push('link_requires_desktop');
    result.failed = selected.length;
    return result;
  }

  const total = selected.length;
  let done = 0;

  for (const row of selected) {
    opts.onProgress?.(done, total, row.vaultPath);
    try {
      const collectionKey =
        row.pageCount > 0 && row.pageCount <= opts.shortPdfMaxPages
          ? opts.collectionShortKey
          : opts.collectionMainKey;

      const absolutePath = resolveVaultPdfAbsolutePath(row.vaultPath);
      let fileBytes: Uint8Array | undefined;
      if (opts.attachmentMode === 'upload') {
        fileBytes = await plugin.app.vault.readBinary(row.file);
      }

      const imp = await plugin.zoteroSync.importVaultPdfAsZoteroItem({
        title: row.title,
        creators: authorToCreators(row.author),
        citationKey: row.citekey,
        itemType: opts.itemType,
        attachmentMode: opts.attachmentMode,
        vaultPath: row.vaultPath,
        absolutePath,
        fileBytes,
        mtimeMs: row.file.stat.mtime,
        collectionStorageKey: collectionKey,
      });

      if (imp.ok) {
        result.created++;
      } else {
        result.failed++;
        result.errors.push(
          `${row.vaultPath}: ${imp.error ?? 'unknown'}`
        );
      }
    } catch (e) {
      result.failed++;
      result.errors.push(
        `${row.vaultPath}: ${String((e as Error)?.message ?? e)}`
      );
    }
    done++;
    opts.onProgress?.(done, total, row.vaultPath);
  }

  if (result.created > 0) {
    await plugin.zoteroSync.sync();
    plugin.bibManager.fileCache.clear();
    plugin.processReferences();
  }

  return result;
}
