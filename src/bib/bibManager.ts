import { EditorView } from '@codemirror/view';
import CSL from 'citeproc';
import ReferenceList from 'src/main';
import { PartialCSLEntry } from './types';
import Fuse from 'fuse.js';
import {
  bibToCSL,
  getBibPath,
  getCSLLocale,
  getCSLStyle,
  getZBib,
  refreshZBib,
} from './helpers';
import {
  PromiseCapability,
  copyElToClipboard,
  getVaultRoot,
} from 'src/helpers';
import { openPdfForPlugin } from 'src/readers/openDocument';
import {
  RenderedCitation,
  getCitationSegments,
  getCitations,
} from 'src/parser/parser';
import LRUCache from 'lru-cache';
import { Keymap, MarkdownView, TFile, setIcon } from 'obsidian';
import { cite } from 'src/parser/citeproc';
import { setCiteKeyCache } from 'src/editorExtension';
import equal from 'fast-deep-equal';
import { t } from 'src/lang/helpers';
import { getPath, getFs, isDesktop } from 'src/platformAdapter';
import {
  getLinkedFilePathFromAttachmentData,
  normalizeWebHref,
} from 'src/zoteroApi/attachmentLinks';
import { zoteroUriForStorageKey } from 'src/zoteroApi/zoteroMerge';
import { zoteroItemToCsl } from 'src/zoteroApi/zoteroToCsl';

const fuseSettings = {
  includeMatches: true,
  threshold: 0.35,
  minMatchCharLength: 2,
  keys: [
    { name: 'id', weight: 0.7 },
    { name: 'title', weight: 0.3 },
  ],
};

interface ScopedSettings {
  style?: string;
  lang?: string;
  bibliography?: string;
}

export interface FileCache {
  keys: Set<string>;
  resolvedKeys: Set<string>;
  unresolvedKeys: Set<string>;
  bib: HTMLElement;
  citations: RenderedCitation[];
  citeBibMap: Map<string, string>;

  settings: ScopedSettings | null;

  source: {
    bibCache?: Map<string, PartialCSLEntry>;
    fuse?: Fuse<PartialCSLEntry>;
    engine?: any;
  };
}

function getScopedSettings(file: TFile): ScopedSettings {
  const metadata = app.metadataCache.getFileCache(file);
  const output: ScopedSettings = {};

  if (!metadata?.frontmatter) {
    return null;
  }

  const { frontmatter } = metadata;

  output.bibliography = frontmatter.bibliography?.trim() || undefined;
  output.style =
    frontmatter.csl?.trim() ||
    frontmatter['citation-style']?.trim() ||
    undefined;
  output.lang =
    frontmatter.lang?.trim() ||
    frontmatter['citation-language']?.trim() ||
    undefined;

  if (Object.values(output).every((v) => !v)) {
    return null;
  }

  const pathApi = getPath();
  const fsApi = getFs();
  const root = getVaultRoot();
  if (root && output.bibliography && fsApi.existsSync(pathApi.join(root, pathApi.dirname(file.path), output.bibliography))) {
    output.bibliography = pathApi.join(root, pathApi.dirname(file.path), output.bibliography);
  }

  return output;
}

function extractRawLocales(style: string, localeName?: string) {
  const locales = ['en-US'];
  if (localeName) {
    locales.push(localeName);
  }
  if (style) {
    const matches = style.match(/locale="[^"]+"/g);
    if (matches) {
      for (const match of matches) {
        const vals = match.slice(0, -1).slice(8).split(/\s+/);
        for (const val of vals) {
          locales.push(val);
        }
      }
    }
  }
  return normalizeLocales(locales);
}

function normalizeLocales(locales: string[]) {
  const obj: Record<string, boolean> = {};
  for (let locale of locales) {
    locale = locale.split('-').slice(0, 2).join('-');
    if (CSL.LANGS[locale]) {
      obj[locale] = true;
    } else {
      locale = locale.split('-')[0];
      if (CSL.LANG_BASES[locale]) {
        locale = CSL.LANG_BASES[locale].split('_').join('-');
        obj[locale] = true;
      }
    }
  }
  return Object.keys(obj);
}

export class BibManager {
  plugin: ReferenceList;
  fileCache: LRUCache<TFile, FileCache>;
  initPromise: PromiseCapability<void>;

  langCache: Map<string, string> = new Map();
  styleCache: Map<string, string> = new Map();

  bibCache: Map<string, PartialCSLEntry> = new Map();
  fuse: Fuse<PartialCSLEntry>;
  engine: any;

  zCitekeyToLinks: Map<string, string> = new Map();
  zCitekeyToPDFLinks: Map<string, string[]> = new Map();
  /** Liens http(s) sur pièces jointes `linked_url` — infobulles / actions rapides */
  zCitekeyToWebLinks: Map<string, string[]> = new Map();

  watcherCache: Map<string, { close: () => void }> = new Map();

  constructor(plugin: ReferenceList) {
    this.plugin = plugin;
    this.initPromise = new PromiseCapability();
    this.fileCache = new LRUCache({
      max: 10,
      noDisposeOnSet: true,
      dispose: (cache) => {
        if (cache.settings?.bibliography) {
          this.clearWatcher(cache.settings.bibliography);
        }
      },
    });
  }

  destroy() {
    this.fileCache.clear();

    for (const watcher of this.watcherCache.values()) {
      watcher.close();
    }

    this.watcherCache.clear();
    this.langCache.clear();
    this.styleCache.clear();
    this.bibCache.clear();
    this.fuse = null;
    this.engine = null;
    this.plugin = null;
  }

  clearWatcher(path: string) {
    if (this.watcherCache.has(path)) {
      this.watcherCache.get(path).close();
      this.watcherCache.delete(path);
    }
  }

  async reinit(clearCache: boolean) {
    this.initPromise = new PromiseCapability();
    this.fileCache.clear();
    if (clearCache) this.bibCache.clear();

    if (this.plugin.settings.pullFromZoteroApi) {
      await this.loadGlobalZoteroApi();
    } else {
      await this.loadGlobalBibFile(true);
    }

    this.initPromise.resolve();
  }

  setFuse(data: PartialCSLEntry[] = []) {
    if (!this.fuse) {
      this.fuse = new Fuse(data, fuseSettings);
    } else {
      this.fuse.setCollection(data);
    }
  }

  updateFuse(data: Map<string, PartialCSLEntry>) {
    if (!this.fuse) return;

    this.fuse.remove((doc) => {
      return data.has(doc.id);
    });

    for (const doc of data.values()) {
      this.fuse.add(doc);
    }
  }

  async loadScopedEngine(settings: ScopedSettings) {
    if (!settings) return this;

    const pluginSettings = this.plugin.settings;
    let style =
      pluginSettings.cslStyleURL ??
      'https://raw.githubusercontent.com/citation-style-language/styles/master/apa.csl';
    let lang = pluginSettings.cslLang ?? 'en-US';
    let bibCache = this.bibCache;
    let fuse = this.fuse;
    let langs = [settings.lang];

    if (settings.style) {
      try {
        const isURL = /^http/.test(settings.style);
        const styleObj = isURL
          ? { id: settings.style }
          : { id: settings.style, explicitPath: settings.style };
        const styles = await this.loadStyles([styleObj]);
        for (const styleStr of styles) {
          langs = extractRawLocales(styleStr, settings.lang);
        }
        style = settings.style;
      } catch (e) {
        console.error(e);
        return this;
      }
    }

    if (settings.lang) {
      try {
        await this.loadLangs(langs);
        lang = settings.lang;
      } catch (e) {
        console.error(e);
        return this;
      }
    }

    if (settings.bibliography) {
      try {
        const bib = await bibToCSL(settings.bibliography, getVaultRoot);
        bibCache = new Map();

        for (const entry of bib) {
          bibCache.set(entry.id, entry);
        }

        fuse = new Fuse(bib, fuseSettings);
      } catch (e) {
        console.error(e);
        return this;
      }
    }

    try {
      const engine = this.buildEngine(
        lang,
        this.langCache,
        style,
        this.styleCache,
        bibCache
      );

      return {
        bibCache,
        fuse,
        engine,
      };
    } catch (e) {
      console.error(e);
      return this;
    }
  }

  async loadGlobalBibFile(fromCache?: boolean) {
    const { settings } = this.plugin;

    if (!settings.pathToBibliography) return;
    if (!fromCache || this.bibCache.size === 0) {
      const bib = await bibToCSL(settings.pathToBibliography, getVaultRoot);

      this.bibCache = new Map();
      const bibPath = getBibPath(settings.pathToBibliography, getVaultRoot);

      if (isDesktop() && bibPath && !this.watcherCache.has(bibPath)) {
        const fsApi = getFs();
        let dbTimer = 0;
        this.watcherCache.set(
          bibPath,
          fsApi.watch(bibPath, (evt) => {
            if (evt === 'change') {
              clearTimeout(dbTimer);
              dbTimer = (typeof activeWindow !== 'undefined' ? activeWindow : window).setTimeout(() => {
                this.loadGlobalBibFile().then(() => {
                  this.fileCache.clear();
                  this.plugin.processReferences();
                });
              }, 100);
            } else {
              this.clearWatcher(bibPath);
            }
          })
        );
      }

      for (const entry of bib) {
        this.bibCache.set(entry.id, entry);
      }

      this.setFuse(bib);
    }

    const style =
      settings.cslStylePath ||
      settings.cslStyleURL ||
      'https://raw.githubusercontent.com/citation-style-language/styles/master/apa.csl';
    const lang = settings.cslLang || 'en-US';

    await this.getLangAndStyle(lang, {
      id: style,
      explicitPath: settings.cslStylePath,
    });
    if (!this.styleCache.has(style)) return;

    try {
      this.engine = this.buildEngine(
        lang,
        this.langCache,
        style,
        this.styleCache,
        this.bibCache
      );
    } catch (e) {
      console.error(e);
    }
  }

  async loadAndRefreshGlobalZBib() {
    await this.loadGlobalZBib(true);
    await this.refreshGlobalZBib();
  }

  async loadGlobalZoteroApi() {
    const sync = this.plugin.zoteroSync;
    if (!sync) return;

    const snap = await sync.loadSnapshot();
    const settings = this.plugin.settings;
    const groupID =
      settings.zoteroApiLibraryType === 'group'
        ? settings.zoteroApiGroupId ?? undefined
        : undefined;

    const bib: PartialCSLEntry[] = [];
    this.zCitekeyToLinks.clear();
    this.zCitekeyToPDFLinks.clear();
    this.zCitekeyToWebLinks.clear();

    this.bibCache = new Map();

    for (const st of Object.values(snap.items)) {
      const csl = zoteroItemToCsl(st, groupID);
      if (csl) {
        bib.push(csl);
        this.bibCache.set(csl.id, csl);
        if (st.key !== csl.id) this.bibCache.set(st.key, csl);
      }
      const link = zoteroUriForStorageKey(st.key, settings);
      if (link) {
        const resolvedCk = csl?.id ?? st.key;
        this.zCitekeyToLinks.set(resolvedCk, link);
        if (csl && st.key !== csl.id) this.zCitekeyToLinks.set(st.key, link);
      }
    }

    for (const st of Object.values(snap.items)) {
      const d = st.data as Record<string, unknown>;
      if (String(d.itemType ?? '') !== 'attachment') continue;
      const parentKey =
        typeof d.parentItem === 'string' ? d.parentItem.trim() : '';
      if (!parentKey) continue;

      const parentSt = snap.items[parentKey];
      if (!parentSt) continue;

      const csl = zoteroItemToCsl(parentSt, groupID);
      if (!csl?.id) continue;

      const pushWeb = (href: string, k: string) => {
        const arr = this.zCitekeyToWebLinks.get(k) ?? [];
        if (!arr.includes(href)) arr.push(href);
        this.zCitekeyToWebLinks.set(k, arr);
      };
      const rawUrl = typeof d.url === 'string' ? d.url.trim() : '';
      const webHref = normalizeWebHref(rawUrl);
      if (/^https?:\/\//i.test(webHref)) {
        pushWeb(webHref, csl.id);
        if (parentSt.key && parentSt.key !== csl.id)
          pushWeb(webHref, parentSt.key);
      }

      const mime = String(d.contentType ?? '');
      const fn = String(d.filename ?? '');
      const pathStr = String(d.path ?? '');
      const isPdf =
        mime.toLowerCase().includes('pdf') ||
        /\.pdf(\b|$)/i.test(fn) ||
        /\.pdf(\b|$)/i.test(pathStr);
      if (!isPdf) continue;

      const local = getLinkedFilePathFromAttachmentData(d);
      if (!local) continue;

      const pushPdf = (k: string) => {
        const arr = this.zCitekeyToPDFLinks.get(k) ?? [];
        if (!arr.includes(local)) arr.push(local);
        this.zCitekeyToPDFLinks.set(k, arr);
      };
      pushPdf(csl.id);
      if (parentSt.key && parentSt.key !== csl.id) pushPdf(parentSt.key);
    }

    this.setFuse(bib);

    const style =
      settings.cslStylePath ||
      settings.cslStyleURL ||
      'https://raw.githubusercontent.com/citation-style-language/styles/master/apa.csl';
    const lang = settings.cslLang || 'en-US';

    await this.getLangAndStyle(lang, {
      id: style,
      explicitPath: settings.cslStylePath,
    });
    if (!this.styleCache.has(style)) return;

    try {
      this.engine = this.buildEngine(
        lang,
        this.langCache,
        style,
        this.styleCache,
        this.bibCache
      );
    } catch (e) {
      console.error(e);
    }
  }

  async loadGlobalZBib(fromCache?: boolean) {
    const { settings, cacheDir } = this.plugin;
    if (!settings.zoteroGroups?.length) return;

    const bib: PartialCSLEntry[] = [];
    for (const group of settings.zoteroGroups) {
      try {
        const list = await getZBib(
          settings.zoteroPort,
          cacheDir,
          group.id,
          fromCache
        );
        if (list?.length) {
          bib.push(...list);
          group.lastUpdate = Date.now();
        }
      } catch (e) {
        console.error('Error fetching bibliography from Zotero', e);
        continue;
      }
    }

    this.plugin.saveSettings();

    this.bibCache = new Map();
    for (const entry of bib) {
      this.bibCache.set(entry.id, entry);
    }

    this.setFuse(bib);

    const style =
      settings.cslStylePath ||
      settings.cslStyleURL ||
      'https://raw.githubusercontent.com/citation-style-language/styles/master/apa.csl';
    const lang = settings.cslLang || 'en-US';

    await this.getLangAndStyle(lang, {
      id: style,
      explicitPath: settings.cslStylePath,
    });
    if (!this.styleCache.has(style)) return;

    try {
      this.engine = this.buildEngine(
        lang,
        this.langCache,
        style,
        this.styleCache,
        this.bibCache
      );
    } catch (e) {
      console.error(e);
    }
  }

  async refreshGlobalZBib() {
    const { settings, cacheDir } = this.plugin;
    if (!settings.zoteroGroups?.length) return;

    const bib: PartialCSLEntry[] = [];
    const modifiedEntries: Map<string, PartialCSLEntry> = new Map();

    for (const group of settings.zoteroGroups) {
      try {
        const res = await refreshZBib(
          settings.zoteroPort,
          cacheDir,
          group.id,
          group.lastUpdate
        );
        if (!res) continue;
        if (res.list?.length) {
          bib.push(...res.list);
          group.lastUpdate = Date.now();
        }

        for (const [k, v] of res.modified.entries()) {
          modifiedEntries.set(k, v);
          this.bibCache.set(k, v);
        }
      } catch (e) {
        console.error('Error fetching bibliography from Zotero', e);
        continue;
      }
    }

    this.plugin.saveSettings();
    this.updateFuse(modifiedEntries);
    this.fileCache.clear();
    this.plugin.processReferences();
  }

  buildEngine(
    lang: string,
    langCache: Map<string, string>,
    style: string,
    styleCache: Map<string, string>,
    bibCache: Map<string, PartialCSLEntry>
  ) {
    const styleXML = styleCache.get(style);
    if (!styleXML) {
      throw new Error(
        'attempting to build citproc engine with empty CSL style'
      );
    }
    if (!langCache.get(lang)) {
      throw new Error(
        'attempting to build citproc engine with empty CSL locale'
      );
    }
    const engine = new CSL.Engine(
      {
        retrieveLocale: (id: string) => {
          return langCache.get(id);
        },
        retrieveItem: (id: string) => {
          return bibCache.get(id);
        },
      },
      styleXML,
      lang
    );
    engine.opt.development_extensions.wrap_url_and_doi = true;
    return engine;
  }

  async getLangAndStyle(
    lang: string,
    style: { id: string; explicitPath?: string }
  ) {
    let styles: string[] = [];
    if (!this.styleCache.has(style.id)) {
      try {
        styles = await this.loadStyles([style]);
      } catch (e) {
        console.error('Error loading style', style, e);
        this.initPromise.resolve();
        return;
      }
    }

    let locales = [lang];
    for (const styleStr of styles) {
      locales = extractRawLocales(styleStr, lang);
    }

    try {
      await this.loadLangs(locales);
    } catch (e) {
      console.error('Error loading lang', lang, e);
      this.initPromise.resolve();
      return;
    }
  }

  async loadLangs(langs: string[]) {
    for (const lang of langs) {
      if (!lang) continue;
      if (!this.langCache.has(lang)) {
        await getCSLLocale(this.langCache, this.plugin.cacheDir, lang);
      }
    }
  }

  async loadStyles(styles: { id?: string; explicitPath?: string }[]) {
    const res: string[] = [];
    for (const style of styles) {
      if (!style.id && !style.explicitPath) continue;
      if (!this.styleCache.has(style.explicitPath ?? style.id)) {
        res.push(
          await getCSLStyle(
            this.styleCache,
            this.plugin.cacheDir,
            style.id,
            style.explicitPath
          )
        );
      }
    }
    return res;
  }

  getNoteForNoteIndex(file: TFile, index: string) {
    if (!this.fileCache.has(file)) {
      return null;
    }

    const cache = this.fileCache.get(file);
    const noteIndex = parseInt(index);

    const cite = cache.citations.find((c) => c.noteIndex === noteIndex);

    if (!cite.note) {
      return null;
    }

    const doc = new DOMParser().parseFromString(cite.note, 'text/html');
    return Array.from(doc.body.childNodes);
  }

  getBibForCiteKey(file: TFile, key: string) {
    if (!this.fileCache.has(file)) {
      return null;
    }

    const cache = this.fileCache.get(file);
    if (!cache.keys.has(key)) {
      return null;
    }

    const html = cache.citeBibMap.get(key);
    if (!html) {
      return null;
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const el = doc.body.firstElementChild as HTMLElement;
    if (el) {
      el.dataset.citekey = key;
      return this.prepBibHTML(el, file, true);
    }
    return el;
  }

  async getReferenceList(file: TFile, content: string) {
    await this.plugin.initPromise.promise;
    await this.initPromise.promise;

    const segs = getCitationSegments(
      content,
      !this.plugin.settings.renderLinkCitations
    );
    const processed = segs.map((s) => getCitations(s));

    if (!processed.length) return null;

    const citeKeys = new Set<string>();
    const unresolvedKeys = new Set<string>();
    const resolvedKeys = new Set<string>();
    const cachedDoc = this.fileCache.has(file)
      ? this.fileCache.get(file)
      : null;
    const citeBibMap = new Map<string, string>();
    const settings = getScopedSettings(file);

    processed.forEach((p) =>
      p.citations.forEach((c) => {
        if (c.id && !citeKeys.has(c.id)) {
          citeKeys.add(c.id);
        }
      })
    );

    const areSettingsEqual =
      settings?.bibliography === cachedDoc?.settings?.bibliography &&
      settings?.style === cachedDoc?.settings?.style &&
      settings?.lang === cachedDoc?.settings?.lang;

    if (!areSettingsEqual && cachedDoc?.settings?.bibliography) {
      this.clearWatcher(cachedDoc.settings.bibliography);
    }

    const source =
      cachedDoc?.source && areSettingsEqual
        ? cachedDoc.source
        : await this.loadScopedEngine(settings);

    if (isDesktop() && settings?.bibliography) {
      const bibPath = getBibPath(settings.bibliography, getVaultRoot);
      if (!this.watcherCache.has(bibPath)) {
        const fsApi = getFs();
        let dbTimer = 0;
        this.watcherCache.set(
          bibPath,
          fsApi.watch(bibPath, (evt) => {
            if (evt === 'change') {
              clearTimeout(dbTimer);
              dbTimer = (typeof activeWindow !== 'undefined' ? activeWindow : window).setTimeout(() => {
                this.fileCache.delete(file);
                this.plugin.processReferences();
              }, 100);
            } else {
              this.clearWatcher(bibPath);
            }
          })
        );
      }
    }

    const setNull = (): null => {
      const result: FileCache = {
        keys: citeKeys,
        resolvedKeys,
        unresolvedKeys,
        bib: null,
        citations: [],
        citeBibMap,
        settings: null,
        source,
      };

      this.fileCache.set(file, result);
      this.dispatchResult(file, result);

      return null;
    };

    if (!source?.engine) {
      return setNull();
    }

    citeKeys.forEach((k) => {
      if (source.bibCache.has(k)) {
        resolvedKeys.add(k);
      } else {
        unresolvedKeys.add(k);
      }
    });

    const filtered = processed.filter((s) =>
      s.citations.every((c) => {
        const resolved = source.bibCache.has(c.id);
        if (resolved) {
          resolvedKeys.add(c.id);
        } else {
          unresolvedKeys.add(c.id);
        }
        return resolved;
      })
    );

    // Do we need this?
    // source.engine.updateItems(Array.from(resolvedKeys));

    const citations = cite(source.engine, filtered);

    if (
      cachedDoc &&
      equal(cachedDoc.citations, citations) &&
      areSettingsEqual
    ) {
      return cachedDoc.bib;
    }

    const bib = source.engine.makeBibliography();

    if (!bib?.length) {
      return setNull();
    }

    const metadata = bib[0];
    const entries = bib[1];
    const htmlStr = [metadata.bibstart];

    metadata.entry_ids?.forEach((e: string, i: number) => {
      entries[i] = entries[i].replace(/>/, ` data-citekey="${e[0]}">`);
      citeBibMap.set(e[0], entries[i]);
    });

    for (const entry of entries) htmlStr.push(entry);

    htmlStr.push(metadata.bibend);
    let parsed = entries.length
      ? (new DOMParser().parseFromString(htmlStr.join(''), 'text/html').body
          .firstElementChild as HTMLElement)
      : null;

    if (parsed) {
      parsed = this.prepBibHTML(parsed, file);
    }

    const result: FileCache = {
      keys: citeKeys,
      resolvedKeys,
      unresolvedKeys,
      bib: parsed,
      citations,
      citeBibMap,
      settings,
      source,
    };

    this.fileCache.set(file, result);
    this.dispatchResult(file, result);

    return result.bib;
  }

  prepBibHTML(parsed: HTMLElement, file: TFile, inTooltip?: boolean) {
    if (this.plugin.settings.hideLinks) {
      parsed?.findAll('a').forEach((l) => {
        l.setAttribute('aria-label', l.innerText);
      });
    }

    if (parsed?.hasClass('csl-entry')) {
      const entry = parsed;
      parsed = createDiv();
      parsed.append(entry);
    }

    parsed?.findAll('.csl-entry').forEach((e) => {
      if (!inTooltip) {
        e.setAttribute('aria-label', t('Click to copy'));
        e.onClickEvent(() => copyElToClipboard(e));
      }

      const div = createDiv({ cls: 'csl-entry-wrapper' });
      e.parentElement.insertBefore(div, e);
      div.append(e);

      if (e.dataset.citekey && !inTooltip) {
        const zLink = this.zCitekeyToLinks.get(e.dataset.citekey);
        const zPDFLinks = this.zCitekeyToPDFLinks.get(e.dataset.citekey);
        const zWebLinks =
          this.zCitekeyToWebLinks.get(e.dataset.citekey) ?? [];
        let linkText = '@' + e.dataset.citekey;
        let linkDest = app.metadataCache.getFirstLinkpathDest(
          linkText,
          file.path
        );
        if (!linkDest) {
          linkText = e.dataset.citekey;
          linkDest = app.metadataCache.getFirstLinkpathDest(
            linkText,
            file.path
          );
        }

        if (!linkDest && !zLink && !zPDFLinks?.length && !zWebLinks.length)
          return;

        div.createDiv({ cls: 'pwc-entry-btns' }, (div) => {
          if (linkDest) {
            div.createDiv('clickable-icon', (div) => {
              setIcon(div, 'sticky-note');
              div.setAttr('aria-label', t('Open literature note'));
              div.onClickEvent((e) => {
                const newPane = Keymap.isModEvent(e);
                app.workspace.openLinkText(linkText, file.path, newPane);
              });
            });
          }
          if (zLink) {
            div.createDiv('clickable-icon', (div) => {
              setIcon(div, 'lucide-external-link');
              div.setAttr('aria-label', t('Open in Zotero'));
              div.onClickEvent(() => {
                activeWindow.open(zLink, '_blank');
              });
            });
          }
          if (zPDFLinks) {
            zPDFLinks.forEach((link) => {
              div.createDiv('clickable-icon', (div) => {
                setIcon(div, 'lucide-file-text');
                div.setAttr('aria-label', getPath().parse(link).base);
                div.onClickEvent(() => {
                  void openPdfForPlugin(
                    this.plugin,
                    link,
                    file.path,
                    undefined,
                    this.plugin.settings.openPdfLinksInNewTab === false
                      ? false
                      : 'tab'
                  );
                });
              });
            });
          }
          zWebLinks.forEach((url) => {
            div.createDiv('clickable-icon', (div) => {
              setIcon(div, 'globe');
              div.setAttr('aria-label', url);
              div.onClickEvent(() => {
                activeWindow.open(url, '_blank');
              });
            });
          });
        });
      }
    });

    return parsed;
  }

  dispatchResult(file: TFile, result: FileCache) {
    app.workspace.getLeavesOfType('markdown').forEach((l) => {
      const view = l.view as MarkdownView;
      if (view.file === file) {
        const renderer = (view.previewMode as any).renderer;
        if (renderer) {
          renderer.lastText = null;
          for (const section of renderer.sections) {
            if (
              !section.el.hasClass('mod-header') &&
              !section.el.hasClass('mod-footer')
            ) {
              section.rendered = false;
              section.el.empty();
            }
          }
          renderer.queueRender();
        }

        const cm = (view.editor as any).cm as EditorView;
        if (cm.dispatch) {
          cm.dispatch({
            effects: [setCiteKeyCache.of(result)],
          });
        }
      }
    });
  }

  getCacheForPath(filePath: string) {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file && file instanceof TFile && this.fileCache.has(file)) {
      const cache = this.fileCache.get(file);
      return cache;
    }

    return null;
  }

  getResolution(filePath: string, key: string) {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file && file instanceof TFile && this.fileCache.has(file)) {
      const cache = this.fileCache.get(file);
      return {
        isResolved: cache.resolvedKeys.has(key),
        isUnresolved: cache.unresolvedKeys.has(key),
      };
    }

    return {
      isResolved: false,
      isUnresolved: false,
    };
  }

  getCitationsForSection(filePath: string, lineStart: number, lineEnd: number) {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file && file instanceof TFile && this.fileCache.has(file)) {
      const cache = this.fileCache.get(file);
      const mCache = app.metadataCache.getCache(filePath);

      const section = mCache.sections?.find(
        (s) =>
          s.position.start.line === lineStart && s.position.end.line === lineEnd
      );

      if (!section) return [];

      const startOffset = section.position.start.offset;
      const endOffset = section.position.end.offset;

      const cites = cache.citations.filter(
        (c) => c.from >= startOffset && c.to <= endOffset
      );
      return cites;
    }

    return [];
  }
}
