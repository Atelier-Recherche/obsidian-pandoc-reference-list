import type { Plugin } from 'obsidian';

/**
 * Obsidian throws if an extension is already registered (core PDF, or plugin reload).
 * Never register `pdf` here — Obsidian owns it; use the file-open router instead.
 */
export function safeRegisterExtensions(
  plugin: Plugin,
  extensions: string[],
  viewType: string
): void {
  try {
    plugin.registerExtensions(extensions, viewType);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/existing file extension/i.test(msg)) {
      console.warn(
        `[PandoCit] Extension already registered (${extensions.join(', ')}), using file-open routing`
      );
      return;
    }
    throw e;
  }
}
