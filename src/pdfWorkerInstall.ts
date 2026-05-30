import { Notice, normalizePath, requestUrl } from 'obsidian';

import type ReferenceList from './main';
import { t } from './lang/helpers';
import { getPluginFolder } from './pandocWasmInstall';

/** Aligné sur `pdfjs-dist` dans package.json. */
export const PDFJS_DIST_VERSION = '5.7.284';

export const PDF_WORKER_DOWNLOAD_URL = `https://unpkg.com/pdfjs-dist@${PDFJS_DIST_VERSION}/legacy/build/pdf.worker.min.mjs`;

export function getPdfWorkerPath(plugin: ReferenceList): string {
  return normalizePath(`${getPluginFolder(plugin)}/pdf.worker.min.mjs`);
}

async function ensureParentDirs(
  plugin: ReferenceList,
  normalizedFilePath: string
): Promise<void> {
  const adapter = plugin.app.vault.adapter;
  const norm = normalizePath(normalizedFilePath);
  const i = norm.lastIndexOf('/');
  if (i <= 0) return;
  const dirPath = norm.slice(0, i);
  const segments = dirPath.split('/').filter(Boolean);
  let cur = '';
  for (const seg of segments) {
    cur = cur ? normalizePath(`${cur}/${seg}`) : seg;
    if (!(await adapter.exists(cur))) {
      await adapter.mkdir(cur);
    }
  }
}

export async function isPdfWorkerInstalled(
  plugin: ReferenceList
): Promise<boolean> {
  const p = getPdfWorkerPath(plugin);
  try {
    return await plugin.app.vault.adapter.exists(p);
  } catch {
    return false;
  }
}

/**
 * Télécharge pdf.worker.min.mjs dans le dossier du plugin (optionnel).
 * Le worker est déjà inclus dans main.js ; ce fichier sert de repli bureau.
 */
export async function downloadAndInstallPdfWorker(
  plugin: ReferenceList,
  opts?: { force?: boolean }
): Promise<boolean> {
  const adapter = plugin.app.vault.adapter;
  const workerPath = getPdfWorkerPath(plugin);

  try {
    if ((await adapter.exists(workerPath)) && !opts?.force) {
      new Notice(t('pdf.worker is already in the plugin folder.'));
      return true;
    }

    new Notice(t('Downloading PDF.js worker…'));

    const res = await requestUrl({ url: PDF_WORKER_DOWNLOAD_URL });
    if (res.status !== 200 || !res.arrayBuffer) {
      throw new Error(`HTTP ${res.status}`);
    }

    const buf = res.arrayBuffer;
    if (!buf.byteLength) {
      throw new Error('empty worker file');
    }

    await ensureParentDirs(plugin, workerPath);
    await adapter.writeBinary(workerPath, buf);

    new Notice(t('PDF.js worker installed. Reload Obsidian to apply.'));
    return true;
  } catch (e) {
    console.error('[PandoCit pdf worker install]', e);
    new Notice(t('PDF.js worker download failed.'));
    return false;
  }
}
