import type { App } from 'obsidian';
import { TFolder } from 'obsidian';

/** Tous les dossiers du coffre (chemins relatifs), triés. */
export function listVaultFolderPaths(app: App): string[] {
  const out: string[] = [];
  const walk = (folder: TFolder) => {
    out.push(folder.path);
    for (const child of folder.children) {
      if (child instanceof TFolder) walk(child);
    }
  };
  const root = app.vault.getRoot();
  for (const child of root.children) {
    if (child instanceof TFolder) walk(child);
  }
  return out.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}
