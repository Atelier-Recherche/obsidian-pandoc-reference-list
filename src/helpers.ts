import {
  App,
  FileSystemAdapter,
  MarkdownView,
  Notice,
  Platform,
  htmlToMarkdown,
} from 'obsidian';
import type { PaneType } from 'obsidian';

import { t } from './lang/helpers';
import { getPath } from './platformAdapter';

const PDF_LOG = '[PandoCit PDF]';

export function logPdfOpen(
  level: 'info' | 'warn',
  message: string,
  details?: Record<string, unknown>
): void {
  if (details) {
    console[level](PDF_LOG, message, details);
  } else {
    console[level](PDF_LOG, message);
  }
}

export function citationInfoUsesTap(): boolean {
  if (Platform.isMobileApp || Platform.isIosApp || Platform.isAndroidApp) {
    return true;
  }
  try {
    return window.matchMedia('(hover: none)').matches;
  } catch {
    return false;
  }
}

export function isAbsoluteFilesystemPath(p: string): boolean {
  const v = p.trim();
  return (
    /^[a-zA-Z]:[\\/]/.test(v) || v.startsWith('/') || v.startsWith('\\\\')
  );
}

/** Chemin relatif au coffre avec `/` (sans segment `..`). */
export function normalizeVaultRelativePath(p: string): string {
  return p.trim().replace(/\\/g, '/').replace(/^\/+/, '');
}

export function getVaultRoot(): string {
  try {
    const adapter = app.vault.adapter;
    if (adapter instanceof FileSystemAdapter) {
      const base = adapter.getBasePath?.();
      if (typeof base === 'string' && base.length > 0) return base;
    }
  } catch {
    //
  }
  return '';
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

function stripFileUrlPrefix(p: string): string {
  let s = p.trim();
  if (/^file:\/\//i.test(s)) {
    try {
      s = decodeURIComponent(s.replace(/^file:\/\//i, ''));
    } catch {
      s = s.replace(/^file:\/\//i, '');
    }
  }
  return s;
}

function vaultHasFileAt(relPath: string): boolean {
  if (!relPath || relPath.includes('..')) return false;
  if (app.vault.getAbstractFileByPath(relPath)) return true;
  const lower = relPath.toLowerCase();
  const files = app.vault.getFiles();
  return files.some(
    (f) =>
      f.path === relPath ||
      f.path.toLowerCase() === lower ||
      f.path.replace(/\\/g, '/').toLowerCase() === lower
  );
}

/** Cherche un fichier du coffre dont le chemin se termine comme `path` (chemins Zotero absolus d’un autre appareil). */
function findVaultPathBySuffix(path: string): string | null {
  const norm = stripFileUrlPrefix(path).replace(/\\/g, '/');
  const segments = norm.split('/').filter(Boolean);
  for (let len = segments.length; len >= 1; len--) {
    const suffix = segments.slice(-len).join('/');
    if (suffix.includes('..')) continue;
    if (vaultHasFileAt(suffix)) return suffix;
  }
  return null;
}

export type PdfPathResolution = {
  rel: string | null;
  strategy: string;
  inputPath: string;
  normalizedInput: string;
  vaultRoot: string;
  checkedPaths: string[];
};

/**
 * Résout un chemin Zotero vers un chemin relatif au coffre, avec journalisation des étapes.
 */
export function resolveVaultRelativePdfPathDetailed(
  path: string
): PdfPathResolution {
  const inputPath = path;
  const vaultRoot = getVaultRoot();
  const checkedPaths: string[] = [];
  const base: Omit<PdfPathResolution, 'rel' | 'strategy'> = {
    inputPath,
    normalizedInput: '',
    vaultRoot,
    checkedPaths,
  };

  const raw = stripFileUrlPrefix(path);
  if (!raw) {
    return { ...base, normalizedInput: '', rel: null, strategy: 'empty-input' };
  }

  const normalizedInput = raw.replace(/\\/g, '/');
  base.normalizedInput = normalizedInput;

  const tryRel = (rel: string, strategy: string): PdfPathResolution | null => {
    checkedPaths.push(rel);
    if (vaultHasFileAt(rel)) {
      return { ...base, rel, strategy };
    }
    return null;
  };

  if (!isAbsoluteFilesystemPath(normalizedInput)) {
    const rel = normalizeVaultRelativePath(normalizedInput);
    if (!rel.includes('..')) {
      const hit = tryRel(rel, 'relative-direct');
      if (hit) return hit;
    }
  }

  if (isAbsoluteFilesystemPath(normalizedInput)) {
    const fromRoot = absolutePathToVaultRelative(normalizedInput);
    if (fromRoot) {
      const hit = tryRel(fromRoot, 'absolute-under-vault-root');
      if (hit) return hit;
    }
  }

  const bySuffix = findVaultPathBySuffix(normalizedInput);
  if (bySuffix) {
    checkedPaths.push(bySuffix);
    return { ...base, rel: bySuffix, strategy: 'suffix-match' };
  }

  if (!isAbsoluteFilesystemPath(normalizedInput)) {
    const rel = normalizeVaultRelativePath(normalizedInput);
    if (!rel.includes('..')) {
      return {
        ...base,
        rel,
        strategy: 'relative-not-found-in-vault',
      };
    }
  }

  return { ...base, rel: null, strategy: 'unresolved' };
}

/**
 * Chemin utilisable par `openLinkText` dans le coffre Obsidian, ou `null`.
 */
export function resolveVaultRelativePdfPath(path: string): string | null {
  return resolveVaultRelativePdfPathDetailed(path).rel;
}

/**
 * Ouvre un PDF dans Obsidian (chemin vault relatif + `#page=` si besoin), sans syntaxe
 * wiki `[[…]]`, pour éviter qu’elle apparaisse dans l’UI ; sinon `file://` externe.
 * @param newLeaf `false` = même groupe de panneaux (souvent vue scindée), `'tab'` ou `true` = nouvel onglet.
 */
export function openPdfAbsolutePathInObsidianOrExternal(
  absPath: string,
  sourcePath: string,
  page: number | null | undefined,
  newLeaf: boolean | PaneType = 'tab'
): void {
  const diag = resolveVaultRelativePdfPathDetailed(absPath);
  const rel = diag.rel;

  logPdfOpen('info', 'open attempt', {
    input: absPath,
    normalized: diag.normalizedInput,
    strategy: diag.strategy,
    resolved: rel,
    vaultRoot: diag.vaultRoot || '(empty)',
    checkedPaths: diag.checkedPaths,
    vaultFileCount: app.vault.getFiles().length,
    platform: Platform.isDesktop ? 'desktop' : 'mobile',
    sourcePath,
    page: page ?? null,
  });

  if (rel) {
    const linktext =
      page != null && Number.isFinite(page)
        ? `${rel}#page=${page}`
        : rel;
    const file = app.vault.getAbstractFileByPath(rel);
    if (!file && diag.strategy === 'relative-not-found-in-vault') {
      logPdfOpen('warn', 'relative path not indexed in vault', {
        rel,
        strategy: diag.strategy,
      });
    }
    try {
      const result = app.workspace.openLinkText(
        linktext,
        sourcePath,
        newLeaf
      ) as unknown;
      if (result && typeof (result as Promise<void>).then === 'function') {
        void (result as Promise<void>).catch((err: unknown) => {
          logPdfOpen('warn', 'openLinkText rejected', {
            linktext,
            error: String(err),
          });
          new Notice(t('PDF open failed see console'));
        });
      } else {
        logPdfOpen('info', 'openLinkText called', { linktext });
      }
    } catch (err) {
      logPdfOpen('warn', 'openLinkText threw', {
        linktext,
        error: String(err),
      });
      new Notice(t('PDF open failed see console'));
    }
    return;
  }

  logPdfOpen('warn', 'could not resolve path for vault', {
    input: absPath,
    normalized: diag.normalizedInput,
    strategy: diag.strategy,
    vaultRoot: diag.vaultRoot || '(empty)',
    checkedPaths: diag.checkedPaths,
    sampleVaultPaths: app.vault
      .getFiles()
      .filter((f) => /\.pdf$/i.test(f.path))
      .slice(0, 5)
      .map((f) => f.path),
  });

  if (!Platform.isDesktop) {
    const pathPreview =
      diag.normalizedInput.length > 72
        ? `${diag.normalizedInput.slice(0, 72)}…`
        : diag.normalizedInput;
    const detail = [
      t('PDF not in vault or unavailable on mobile'),
      `${t('PDF open path label')}: ${pathPreview || '—'}`,
      `${t('PDF open strategy label')}: ${diag.strategy}`,
      diag.checkedPaths.length
        ? `${t('PDF open tried label')}: ${diag.checkedPaths.slice(-3).join(', ')}`
        : '',
      t('PDF open log hint'),
    ]
      .filter(Boolean)
      .join('\n');
    new Notice(detail, 12000);
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
