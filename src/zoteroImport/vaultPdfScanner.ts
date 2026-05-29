import { TFile, TFolder } from 'obsidian';

import type ReferenceList from '../main';
import { getVaultPdfImportSettings, shouldExcludeVaultPath } from './importExclusions';
import { parsePdfMetadataFromPath } from './metadataParser';
import { suggestCitekey } from './citekeySuggest';
import { countPdfPages } from './pdfPageCount';
import type { VaultPdfImportRow, VaultPdfImportScanResult } from './types';
import { findZoteroAttachmentKeyForVaultFile } from '../readers/pdf/zoteroAttachmentMatch';

function collectPdfFiles(folder: TFolder, out: TFile[]): void {
  for (const child of folder.children) {
    if (child instanceof TFolder) {
      collectPdfFiles(child, out);
    } else if (
      child instanceof TFile &&
      child.extension.toLowerCase() === 'pdf'
    ) {
      out.push(child);
    }
  }
}

export async function scanVaultFolderForPdfImport(
  plugin: ReferenceList,
  folderPath: string,
  onProgress?: (done: number, total: number) => void
): Promise<VaultPdfImportScanResult> {
  const folder = plugin.app.vault.getAbstractFileByPath(folderPath);
  if (!(folder instanceof TFolder)) {
    return { rows: [], excludedCount: 0, folderPath };
  }

  const rules = getVaultPdfImportSettings(plugin.settings.vaultPdfImport);
  const raw: TFile[] = [];
  collectPdfFiles(folder, raw);

  const candidates: TFile[] = [];
  let excludedCount = 0;
  for (const f of raw) {
    if (shouldExcludeVaultPath(f.path, rules)) {
      excludedCount++;
      continue;
    }
    candidates.push(f);
  }

  const rows: VaultPdfImportRow[] = [];
  const total = candidates.length;
  let done = 0;

  for (const file of candidates) {
    onProgress?.(done, total);
    try {
      const bytes = await plugin.app.vault.readBinary(file);
      const pageCount = await countPdfPages(plugin, bytes);
      const meta = parsePdfMetadataFromPath(
        file.path,
        rules.metadataRegex
      );
      const existingKey = plugin.settings.pullFromZoteroApi
        ? await findZoteroAttachmentKeyForVaultFile(plugin, file, {
            fresh: true,
          })
        : undefined;
      const status = existingKey ? 'duplicate' : 'new';
      const citekey = suggestCitekey(
        meta.author,
        meta.title,
        file.stat.mtime,
        meta.citekey
      );
      rows.push({
        file,
        vaultPath: file.path,
        pageCount,
        title: meta.title,
        author: meta.author,
        citekey,
        selected: status === 'new',
        status,
      });
    } catch (e) {
      rows.push({
        file,
        vaultPath: file.path,
        pageCount: 0,
        title: file.basename,
        author: '',
        citekey: '',
        selected: false,
        status: 'error',
        errorMessage: String((e as Error)?.message ?? e),
      });
    }
    done++;
    onProgress?.(done, total);
  }

  return { rows, excludedCount, folderPath };
}
