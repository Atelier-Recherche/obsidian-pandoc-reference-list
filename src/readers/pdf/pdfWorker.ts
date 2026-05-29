import { FileSystemAdapter, Platform, Plugin } from 'obsidian';
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

import { getPath } from '../../platformAdapter';

/** Injected at build time by esbuild (see esbuild.config.mjs). */
declare const __PDF_WORKER_CODE__: string | undefined;

let configured = false;
let blobUrl: string | null = null;

function configureFromInlineBlob(): boolean {
  if (typeof __PDF_WORKER_CODE__ !== 'string' || !__PDF_WORKER_CODE__.length) {
    return false;
  }
  try {
    const blob = new Blob([__PDF_WORKER_CODE__], {
      type: 'application/javascript',
    });
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
