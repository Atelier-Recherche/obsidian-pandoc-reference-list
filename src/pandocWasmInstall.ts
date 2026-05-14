import { Notice, normalizePath, requestUrl } from 'obsidian';
import { unzipSync } from 'fflate';

import type ReferenceList from './main';
import { t } from './lang/helpers';

export const PANDOC_WASM_ZIP_URL =
  'https://github.com/jgm/pandoc/releases/download/3.9.0.2/pandoc.wasm.zip';

/** Chemin relatif au coffre : dossier du plugin (ex. `.obsidian/plugins/<id>`). */
export function getPluginFolder(plugin: ReferenceList): string {
  return normalizePath(`.obsidian/plugins/${plugin.manifest.id}`);
}

/** Chemin relatif au coffre : `pandoc.wasm` à côté de `main.js`. */
export function getPandocWasmPath(plugin: ReferenceList): string {
  return normalizePath(`${getPluginFolder(plugin)}/pandoc.wasm`);
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

export async function isPandocWasmInstalled(
  plugin: ReferenceList
): Promise<boolean> {
  const p = getPandocWasmPath(plugin);
  try {
    return await plugin.app.vault.adapter.exists(p);
  } catch {
    return false;
  }
}

/**
 * Télécharge l’archive officielle, extrait `pandoc.wasm` dans le dossier du plugin
 * (via `vault.adapter`, compatible bureau et mobile dont Android).
 */
export async function downloadAndInstallPandocWasm(
  plugin: ReferenceList,
  opts?: { force?: boolean }
): Promise<boolean> {
  const adapter = plugin.app.vault.adapter;
  const wasmPath = getPandocWasmPath(plugin);

  try {
    if ((await adapter.exists(wasmPath)) && !opts?.force) {
      new Notice(t('pandoc.wasm is already in the plugin folder.'));
      return true;
    }

    new Notice(t('Downloading Pandoc WASM…'));

    const res = await requestUrl({ url: PANDOC_WASM_ZIP_URL });
    if (res.status !== 200 || !res.arrayBuffer) {
      throw new Error(`HTTP ${res.status}`);
    }

    const extracted = unzipSync(new Uint8Array(res.arrayBuffer));
    const wasmKey = Object.keys(extracted).find((k) =>
      /(^|\/)pandoc\.wasm$/i.test(k)
    );
    if (!wasmKey || !extracted[wasmKey]?.length) {
      throw new Error('pandoc.wasm not found in zip');
    }

    await ensureParentDirs(plugin, wasmPath);

    const wasmBytes = extracted[wasmKey];
    const buf = wasmBytes.buffer.slice(
      wasmBytes.byteOffset,
      wasmBytes.byteOffset + wasmBytes.byteLength
    );

    await adapter.writeBinary(wasmPath, buf);

    new Notice(t('Pandoc WASM installed. Reload Obsidian to apply.'));
    return true;
  } catch (e) {
    console.error('[pandoc wasm install]', e);
    new Notice(t('Pandoc WASM download failed.'));
    return false;
  }
}
