import type { TFile } from 'obsidian';

export type VaultPdfImportRowStatus = 'new' | 'duplicate' | 'error';

export interface VaultPdfImportRow {
  file: TFile;
  vaultPath: string;
  pageCount: number;
  title: string;
  author: string;
  citekey: string;
  selected: boolean;
  status: VaultPdfImportRowStatus;
  errorMessage?: string;
}

export interface VaultPdfImportScanResult {
  rows: VaultPdfImportRow[];
  excludedCount: number;
  folderPath: string;
}
