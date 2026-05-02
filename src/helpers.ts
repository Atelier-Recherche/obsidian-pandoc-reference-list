import {
  App,
  FileSystemAdapter,
  MarkdownView,
  Platform,
  htmlToMarkdown,
} from 'obsidian';

import { getPath } from './platformAdapter';

export function getVaultRoot(): string {
  if (!Platform.isDesktop) return '';
  try {
    return (app.vault.adapter as FileSystemAdapter).getBasePath();
  } catch {
    return '';
  }
}

/**
 * Si `absPath` est sous la racine du coffre, retourne un chemin relatif avec `/`
 * (pour liens wiki). Sinon `null`.
 */
export function absolutePathToVaultRelative(absPath: string): string | null {
  const root = getVaultRoot();
  if (!root || !absPath?.trim()) return null;
  const pathMod = getPath() as import('path').PlatformPath;
  if (typeof pathMod.relative !== 'function') return null;
  const r = pathMod.normalize(root);
  const a = pathMod.normalize(absPath.trim());
  const rel = pathMod.relative(r, a);
  if (!rel || rel.startsWith('..')) return null;
  return rel.split(/[/\\]+/).join('/');
}

/**
 * Ouvre un PDF dans Obsidian (chemin vault relatif + `#page=` si besoin), sans syntaxe
 * wiki `[[…]]`, pour éviter qu’elle apparaisse dans l’UI ; sinon `file://` externe.
 */
export function openPdfAbsolutePathInObsidianOrExternal(
  absPath: string,
  sourcePath: string,
  page: number | null | undefined
): void {
  const rel = absolutePathToVaultRelative(absPath);
  if (rel) {
    const linktext =
      page != null && Number.isFinite(page)
        ? `${rel}#page=${page}`
        : rel;
    app.workspace.openLinkText(linktext, sourcePath, false);
    return;
  }
  const href =
    page != null && Number.isFinite(page)
      ? `file://${encodeURI(absPath)}#page=${page}`
      : `file://${encodeURI(absPath)}`;
  activeWindow.open(href, '_blank');
}

export function copyElToClipboard(el: HTMLElement) {
  const html = el.outerHTML;
  const text = htmlToMarkdown(el.outerHTML);

  if (Platform.isDesktop) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { clipboard } = require('electron');
      clipboard.write({ html, text });
      return;
    } catch (e) {
      console.error('Failed to access electron clipboard', e);
    }
  }

  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch((e) => {
      console.error('Failed to write to clipboard', e);
    });
  }
}

export class PromiseCapability<T> {
  settled = false;
  promise: Promise<T>;
  resolve: (data: T) => void;
  reject: (reason?: any) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = (data) => {
        resolve(data);
        this.settled = true;
      };

      this.reject = (reason) => {
        reject(reason);
        this.settled = true;
      };
    });
  }
}

export function areSetsEqual<T>(as: Set<T>, bs: Set<T>) {
  if (as.size !== bs.size) return false;
  for (const a of as) if (!bs.has(a)) return false;
  return true;
}

/**
 * Insère du texte dans la note Markdown éditée : quand un panneau latéral (ex. Zotero)
 * a le focus, `getActiveViewOfType(MarkdownView)` est null — on cible les feuilles de
 * la zone principale via `iterateRootLeaves` et le fichier « dernier actif » de
 * `getActiveFile()`.
 */
export function insertTextInActiveMarkdownNote(app: App, text: string): boolean {
  const { workspace } = app;
  const activeFile = workspace.getActiveFile();

  const insert = (view: MarkdownView) => {
    view.editor.replaceSelection(text);
    return true;
  };

  if (activeFile?.extension === 'md') {
    let match: MarkdownView | null = null;
    workspace.iterateRootLeaves((leaf) => {
      const v = leaf.view;
      if (v instanceof MarkdownView && v.file === activeFile && v.editor) {
        match = v;
      }
    });
    if (match) return insert(match);
  }

  const ae = workspace.activeEditor;
  if (ae?.editor && ae.file?.extension === 'md') {
    ae.editor.replaceSelection(text);
    return true;
  }

  const activeView = workspace.activeLeaf?.view;
  if (activeView instanceof MarkdownView && activeView.editor) {
    return insert(activeView);
  }

  let fallback: MarkdownView | null = null;
  workspace.iterateRootLeaves((leaf) => {
    const v = leaf.view;
    if (v instanceof MarkdownView && v.editor && v.file?.extension === 'md') {
      fallback = v;
    }
  });
  if (fallback) return insert(fallback);

  const md = workspace.getActiveViewOfType(MarkdownView);
  if (md?.editor) return insert(md);

  return false;
}
