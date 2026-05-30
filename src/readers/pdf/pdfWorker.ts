import { FileSystemAdapter, Platform, Plugin } from 'obsidian';
import { gunzipSync } from 'fflate';
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

import { getPath } from '../../platformAdapter';

/** Build prod : worker gzip+base64 injecté (esbuild). Dev : texte brut. */
declare const __PDF_WORKER_GZ_B64__: string | undefined;
declare const __PDF_WORKER_CODE__: string | undefined;

let configured = false;
let blobUrl: string | null = null;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeEmbeddedWorker(): string | null {
  if (typeof __PDF_WORKER_GZ_B64__ === 'string' && __PDF_WORKER_GZ_B64__.length) {
    try {
      const gz = base64ToBytes(__PDF_WORKER_GZ_B64__);
      return new TextDecoder().decode(gunzipSync(gz));
    } catch (e) {
      console.error('[PandoCit PDF] gzip worker decode failed', e);
    }
  }
  if (typeof __PDF_WORKER_CODE__ === 'string' && __PDF_WORKER_CODE__.length) {
    return __PDF_WORKER_CODE__;
  }
  return null;
}

function configureFromInlineBlob(): boolean {
  const code = decodeEmbeddedWorker();
  if (!code) return false;
  try {
    const blob = new Blob([code], { type: 'application/javascript' });
    blobUrl = URL.createObjectURL(blob);
    GlobalWorkerOptions.workerSrc = blobUrl;
    return true;
  } catch (e) {
    console.error('[PandoCit PDF] inline worker blob failed', e);
    return false;
  }
}

function configureFromFilesystem(plugin: Plugin): boolean {
  if (!Platform.isDesktop) return false;
  const adapter = plugin.app.vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) return false;
  const pathMod = getPath();
  const base = adapter.getBasePath();
  if (!base) return false;
  const full = pathMod.join(
    base,
    '.obsidian',
    'plugins',
    plugin.manifest.id,
    'pdf.worker.min.mjs'
  );
  const normalized = full.replace(/\\/g, '/');
  const fileUrl = normalized.startsWith('/')
    ? `file://${normalized}`
    : `file:///${normalized}`;
  GlobalWorkerOptions.workerSrc = fileUrl;
  return true;
}

function configureFromResourcePath(plugin: Plugin): boolean {
  const adapter = plugin.app.vault.adapter as {
    getResourcePath?: (p: string) => string;
  };
  if (!adapter.getResourcePath) return false;
  const rel = `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}/pdf.worker.min.mjs`;
  const src = adapter.getResourcePath(rel);
  if (!src) return false;
  GlobalWorkerOptions.workerSrc = src;
  return true;
}

/** Configure pdf.js worker once (inline blob preferred — works on all platforms). */
export function configurePdfWorker(plugin: Plugin): void {
  if (configured) return;
  if (
    configureFromInlineBlob() ||
    configureFromFilesystem(plugin) ||
    configureFromResourcePath(plugin)
  ) {
    configured = true;
    return;
  }
  console.warn(
    '[PandoCit PDF] Could not configure pdf.js worker — PDF reader may fail'
  );
}

export function resetPdfWorkerForTests(): void {
  configured = false;
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrl = null;
  }
}
