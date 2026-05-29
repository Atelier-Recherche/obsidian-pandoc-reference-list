import type { Plugin } from 'obsidian';
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';

function getResourcePath(plugin: Plugin, relativePath: string): string | null {
  const adapter = plugin.app.vault.adapter as {
    getResourcePath?: (p: string) => string;
  };
  if (!adapter.getResourcePath) return null;
  const src = adapter.getResourcePath(relativePath);
  return src || null;
}

function appendToResourceUrl(baseUrl: string, suffix: string): string {
  const [withoutHash, hashPart] = baseUrl.split('#', 2);
  const [pathPart, queryPart] = withoutHash.split('?', 2);
  const cleanPath = pathPart.endsWith('/') ? pathPart : `${pathPart}/`;
  const merged = `${cleanPath}${suffix}`;
  const withQuery = queryPart ? `${merged}?${queryPart}` : merged;
  return hashPart ? `${withQuery}#${hashPart}` : withQuery;
}

/** Base URL (with trailing slash) for pdf.js static assets shipped with the plugin. */
export function pdfAssetsBaseUrl(plugin: Plugin): string | null {
  const rel = `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}/pdf-assets/`;
  const base = getResourcePath(plugin, rel);
  if (!base) return null;
  const [withoutHash, hashPart] = base.split('#', 2);
  const [pathPart] = withoutHash.split('?', 1);
  const pathOnly = pathPart.endsWith('/') ? pathPart : `${pathPart}/`;
  return hashPart ? `${pathOnly}#${hashPart}` : pathOnly;
}

/** Init options for pdf.js `getDocument` (WASM, fonts, ICC). */
export function pdfGetDocumentInit(
  plugin: Plugin,
  bytes: ArrayBuffer
): DocumentInitParameters {
  const data = new Uint8Array(bytes.slice(0));
  const cdnBase = 'https://unpkg.com/pdfjs-dist@5.7.284/';
  const localBase = pdfAssetsBaseUrl(plugin);
  if (!localBase) {
    console.warn(
      '[PandoCit PDF] pdf-assets base URL unavailable — using CDN assets'
    );
  }
  const assetBase = cdnBase;
  return {
    data,
    useSystemFonts: true,
    useWasm: true,
    useWorkerFetch: true,
    wasmUrl: appendToResourceUrl(assetBase, 'wasm/'),
    standardFontDataUrl: appendToResourceUrl(assetBase, 'standard_fonts/'),
    iccUrl: appendToResourceUrl(assetBase, 'iccs/'),
  };
}
