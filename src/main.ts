import './polyfills/mapGetOrInsertComputed';

import {
  Events,
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  WorkspaceLeaf,
  debounce,
  setIcon,
} from 'obsidian';

import {
  citeKeyCacheField,
  citeKeyPlugin,
  bibManagerField,
  editorTooltipHandler,
} from './editorExtension';
import { setPluginUiLocale, t } from './lang/helpers';
import { processCiteKeys } from './markdownPostprocessor';
import {
  DEFAULT_SETTINGS,
  ReferenceListSettings,
  ReferenceListSettingsTab,
} from './settings';
import { TooltipManager } from './tooltip';
import { viewType as legacyRefViewType } from './view';
import { zoteroLibraryViewType } from './zoteroLibraryView';
import { ZoteroSyncService, noticeSyncResult } from './zoteroApi/zoteroSync';
import { writeBibtexExportToVault } from './zoteroApi/zoteroToBibtex';
import { PromiseCapability, getVaultRoot } from './helpers';
import { getPath } from './platformAdapter';
import { BibManager } from './bib/bibManager';
import { CiteSuggest } from './citeSuggest/citeSuggest';
import {
  PandoCitShellView,
  shellViewType,
} from './shell/PandoCitShellView';
import type { ShellTab } from './shell/types';
import { legacyViewTypes } from './shell/types';
import { PdfReaderView, pdfReaderViewType } from './readers/pdf/PdfReaderView';
import { EpubReaderView, epubReaderViewType } from './readers/epub/EpubReaderView';
import { registerDocumentOpenRouter } from './readers/documentRouter';
import { safeRegisterExtensions } from './readers/registerExtensionsSafe';
import { ZoteroAnnotationIndex } from './annotations/zoteroAnnotationIndex';

export default class ReferenceList extends Plugin {
  settings: ReferenceListSettings;
  emitter: Events;
  tooltipManager: TooltipManager;
  cacheDir: string;
  bibManager: BibManager;
  zoteroSync: ZoteroSyncService;
  zoteroAnnotationIndex: ZoteroAnnotationIndex;
  _initPromise: PromiseCapability<void>;
  pendingShellTab?: ShellTab;
  skipFileOpenRoute = false;

  get initPromise() {
    if (!this._initPromise) {
      return (this._initPromise = new PromiseCapability());
    }
    return this._initPromise;
  }

  async onload() {
    const { app } = this;

    await this.loadSettings();

    this.registerView(
      shellViewType,
      (leaf: WorkspaceLeaf) => new PandoCitShellView(leaf, this)
    );
    this.registerView(
      pdfReaderViewType,
      (leaf: WorkspaceLeaf) => new PdfReaderView(leaf, this)
    );
    this.registerView(
      epubReaderViewType,
      (leaf: WorkspaceLeaf) => new EpubReaderView(leaf, this)
    );

    // PDF : jamais registerExtensions — réservé au viewer Obsidian ; routage via file-open.
    safeRegisterExtensions(this, ['epub'], epubReaderViewType);

    this.zoteroSync = new ZoteroSyncService(this);
    this.zoteroAnnotationIndex = new ZoteroAnnotationIndex();
    this.cacheDir = getPath().join(getVaultRoot(), '.pandoc');
    this.emitter = new Events();
    this.bibManager = new BibManager(this);
    this.initPromise.promise
      .then(async () => {
        if (this.settings.pullFromZoteroApi) {
          await this.bibManager.loadGlobalZoteroApi();
          const snap = await this.zoteroSync.loadSnapshot();
          const empty =
            !Object.keys(snap.items).length && !!this.settings.zoteroApiKey;
          if (empty) {
            const r = await this.zoteroSync.sync();
            noticeSyncResult(r, t);
            await this.bibManager.loadGlobalZoteroApi();
          }
          await this.zoteroAnnotationIndex.refresh(this);
        } else {
          await this.bibManager.loadGlobalBibFile();
        }
      })
      .finally(() => this.bibManager.initPromise.resolve());

    void this.migrateLegacyLeaves();

    this.addSettingTab(new ReferenceListSettingsTab(this));
    this.registerEditorSuggest(new CiteSuggest(app, this));
    this.tooltipManager = new TooltipManager(this);
    this.registerMarkdownPostProcessor(processCiteKeys(this));
    this.registerEditorExtension([
      bibManagerField.init(() => this.bibManager),
      citeKeyCacheField,
      citeKeyPlugin,
      editorTooltipHandler(this.tooltipManager),
    ]);

    registerDocumentOpenRouter(this);

    this.initPromise.resolve();
    this.app.workspace.trigger('parse-style-settings');

    this.addCommand({
      id: 'focus-reference-list-view',
      name: t('Show reference list'),
      callback: async () => {
        await this.initShell('references');
      },
    });

    this.addCommand({
      id: 'zotero-library-panel',
      name: t('Open Zotero library panel'),
      callback: async () => {
        await this.initShell('zotero');
      },
    });

    this.addCommand({
      id: 'pwc-document-annotations-panel',
      name: t('Document annotations panel'),
      callback: async () => {
        await this.initShell('document-annotations');
      },
    });

    this.addCommand({
      id: 'pwc-open-with-reader',
      name: t('Open current file with PandoCit reader'),
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new Notice(t('No active file'));
          return;
        }
        const { openInPandocitReader, documentKindForFile } = await import(
          './readers/documentRouter'
        );
        if (!documentKindForFile(file)) {
          new Notice(t('Unsupported document type'));
          return;
        }
        await openInPandocitReader(this, file);
      },
    });

    this.addCommand({
      id: 'vault-pdf-import-zotero',
      name: t('Import vault PDF folder to Zotero'),
      callback: () => {
        void import('./zoteroImport/VaultPdfImportModal').then(({ openVaultPdfImportModal }) =>
          openVaultPdfImportModal(this)
        );
      },
    });

    this.addCommand({
      id: 'zotero-search-annotations',
      name: t('Search Zotero annotations'),
      callback: async () => {
        if (!this.settings.pullFromZoteroApi) {
          new Notice(t('Enable “Use Zotero Web API” in plugin settings first'));
          return;
        }
        await this.zoteroAnnotationIndex.refresh(this);
        await this.initShell('zotero');
        const panel = this.shell?.zoteroPanel;
        if (panel) {
          panel.searchAnnotationsToggle.checked = true;
          panel.filterInput.focus();
          panel.render();
        }
      },
    });

    this.addCommand({
      id: 'zotero-library-sync',
      name: t('Sync Zotero library (Web API)'),
      callback: async () => {
        if (!this.settings.pullFromZoteroApi) {
          new Notice(t('Enable “Use Zotero Web API” in plugin settings first'));
          return;
        }
        const r = await this.zoteroSync.sync();
        noticeSyncResult(r, t);
        await this.zoteroAnnotationIndex.refresh(this);
        this.bibManager.reinit(true);
        await this.bibManager.initPromise.promise;
        this.processReferences();
        await this.shell?.zoteroPanel?.refreshList();
      },
    });

    this.addCommand({
      id: 'zotero-export-bib',
      name: t('Export Zotero API library to BibTeX'),
      callback: async () => {
        if (!this.settings.pullFromZoteroApi) {
          new Notice(t('Enable “Use Zotero Web API” in plugin settings first'));
          return;
        }
        const p = this.settings.zoteroApiBibExportPath?.trim();
        if (!p) {
          new Notice(t('Set the BibTeX path in Zotero Web API settings'));
          return;
        }
        const snap = await this.zoteroSync.loadSnapshot();
        const res = await writeBibtexExportToVault(this.app, snap, p);
        if (res.ok) {
          new Notice(
            `${t('BibTeX export saved')} (${res.entryCount ?? 0} ${t(
              'entries'
            )}) → ${res.path}`
          );
        } else if (res.error === 'need_bib_extension') {
          new Notice(t('Path must end with .bib'));
        } else {
          new Notice(`${t('Export failed')}: ${res.error ?? ''}`);
        }
      },
    });

    document.body.toggleClass(
      'pwc-tooltips',
      !!this.settings.showCitekeyTooltips
    );
    TooltipManager.syncTapModeBodyClass(!!this.settings.showCitekeyTooltips);

    this.registerEvent(
      app.metadataCache.on(
        'changed',
        debounce(
          async (file) => {
            await this.initPromise.promise;
            await this.bibManager.initPromise.promise;

            const activeView = app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView && file === activeView.file) {
              this.processReferences();
            }
          },
          100,
          true
        )
      )
    );

    this.registerEvent(
      app.workspace.on(
        'active-leaf-change',
        debounce(
          async (leaf) => {
            await this.initPromise.promise;
            await this.bibManager.initPromise.promise;

            app.workspace.iterateRootLeaves((rootLeaf) => {
              if (rootLeaf === leaf) {
                if (leaf.view instanceof MarkdownView) {
                  this.processReferences();
                } else {
                  this.shell?.refsPanel.setNoContentMessage();
                }
              }
            });
            this.shell?.docPanel?.render();
          },
          100,
          true
        )
      )
    );

    (async () => {
      this.initStatusBar();
      this.setStatusBarLoading();

      await this.initPromise.promise;
      await this.bibManager.initPromise.promise;

      this.setStatusBarIdle();
      this.processReferences();
    })();
  }

  onunload() {
    document.body.removeClass('pwc-tooltips', 'pwc-cite-tap-mode');
    for (const type of [
      shellViewType,
      pdfReaderViewType,
      epubReaderViewType,
      legacyRefViewType,
      zoteroLibraryViewType,
    ]) {
      this.app.workspace.getLeavesOfType(type).forEach((leaf) => leaf.detach());
    }
    this.bibManager?.destroy();
  }

  private async migrateLegacyLeaves(): Promise<void> {
    const { workspace } = this.app;
    for (const oldType of legacyViewTypes) {
      const leaves = workspace.getLeavesOfType(oldType);
      for (const leaf of leaves) {
        await leaf.setViewState({ type: shellViewType, active: true });
      }
    }
  }

  get shell(): PandoCitShellView | null {
    const leaves = this.app.workspace.getLeavesOfType(shellViewType);
    if (!leaves.length) return null;
    const v = leaves[0].view;
    return v instanceof PandoCitShellView ? v : null;
  }

  async initShell(tab: ShellTab = 'references'): Promise<void> {
    this.pendingShellTab = tab;
    const existing = this.shell;
    if (existing) {
      this.app.workspace.revealLeaf(existing.leaf);
      existing.switchTab(tab);
      this.pendingShellTab = undefined;
      if (tab === 'references') this.processReferences();
      return;
    }

    await this.app.workspace.getRightLeaf(false).setViewState({
      type: shellViewType,
    });
    this.revealShell();
    this.pendingShellTab = undefined;

    await this.initPromise.promise;
    await this.bibManager.initPromise.promise;
    if (tab === 'references') this.processReferences();
    this.shell?.switchTab(tab);
  }

  revealShell(): void {
    const leaves = this.app.workspace.getLeavesOfType(shellViewType);
    if (leaves.length) this.app.workspace.revealLeaf(leaves[0]);
  }

  statusBarIcon: HTMLElement;
  initStatusBar() {
    const ico = (this.statusBarIcon = this.addStatusBarItem());
    ico.addClass('pwc-status-icon', 'clickable-icon');
    ico.setAttr('aria-label', t('Pandoc reference list settings'));
    ico.setAttr('data-tooltip-position', 'top');
    this.setStatusBarIdle();
    let isOpen = false;
    ico.addEventListener('click', () => {
      if (isOpen) return;
      const { settings } = this;
      const menu = (new Menu() as any)
        .addSections(['settings', 'actions'])
        .addItem((item: any) =>
          item
            .setSection('settings')
            .setIcon('lucide-message-square')
            .setTitle(t('Show citekey tooltips'))
            .setChecked(!!settings.showCitekeyTooltips)
            .onClick(() => {
              this.settings.showCitekeyTooltips = !settings.showCitekeyTooltips;
              this.saveSettings();
            })
        )
        .addItem((item: any) =>
          item
            .setSection('settings')
            .setIcon('lucide-at-sign')
            .setTitle(t('Show citekey suggestions'))
            .setChecked(!!settings.enableCiteKeyCompletion)
            .onClick(() => {
              this.settings.enableCiteKeyCompletion =
                !settings.enableCiteKeyCompletion;
              this.saveSettings();
            })
        )
        .addItem((item: any) =>
          item
            .setSection('actions')
            .setIcon('lucide-layout-panel-left')
            .setTitle(t('Show PandoCit panel'))
            .onClick(() => void this.initShell('references'))
        )
        .addItem((item: any) =>
          item
            .setSection('actions')
            .setIcon('lucide-rotate-cw')
            .setTitle(t('Refresh bibliography'))
            .onClick(async () => {
              const activeView =
                this.app.workspace.getActiveViewOfType(MarkdownView);
              if (activeView) {
                const file = activeView.file;

                if (this.bibManager.fileCache.has(file)) {
                  const cache = this.bibManager.fileCache.get(file);
                  if (cache.source !== this.bibManager) {
                    this.bibManager.fileCache.delete(file);
                    this.processReferences();
                    return;
                  }
                }
              }

              if (this.settings.pullFromZoteroApi) {
                const r = await this.zoteroSync.sync();
                noticeSyncResult(r, t);
                await this.zoteroAnnotationIndex.refresh(this);
              }

              this.bibManager.reinit(true);
              await this.bibManager.initPromise.promise;
              this.processReferences();
            })
        );

      const rect = ico.getBoundingClientRect();
      menu.onHide(() => {
        isOpen = false;
      });
      menu.setParentElement(ico).showAtPosition({
        x: rect.x,
        y: rect.top - 5,
        width: rect.width,
        overlap: true,
        left: false,
      });
      isOpen = true;
    });
  }

  setStatusBarLoading() {
    this.statusBarIcon.addClass('is-loading');
    setIcon(this.statusBarIcon, 'lucide-loader');
  }

  setStatusBarIdle() {
    this.statusBarIcon.removeClass('is-loading');
    setIcon(this.statusBarIcon, 'lucide-at-sign');
  }

  async loadSettings() {
    const loaded = await this.loadData();
    const safeLoaded =
      loaded && typeof loaded === 'object'
        ? (loaded as Record<string, unknown>)
        : {};
    const merged = Object.assign(
      {},
      DEFAULT_SETTINGS,
      safeLoaded
    ) as ReferenceListSettings;
    const raw = safeLoaded as { zoteroApiMergeGroupId?: number };
    if (
      (!merged.zoteroApiMergeGroupIds ||
        merged.zoteroApiMergeGroupIds.length === 0) &&
      raw.zoteroApiMergeGroupId != null &&
      Number.isFinite(Number(raw.zoteroApiMergeGroupId))
    ) {
      merged.zoteroApiMergeGroupIds = [Number(raw.zoteroApiMergeGroupId)];
    }
    this.settings = merged;
    setPluginUiLocale(this.settings.pluginUiLocale);
  }

  async saveSettings(cb?: () => void) {
    document.body.toggleClass(
      'pwc-tooltips',
      !!this.settings.showCitekeyTooltips
    );
    TooltipManager.syncTapModeBodyClass(!!this.settings.showCitekeyTooltips);

    this.emitSettingsUpdate(cb);
    await this.saveData(this.settings);
  }

  emitSettingsUpdate = debounce(
    (cb?: () => void) => {
      if (this.initPromise.settled) {
        this.shell?.refsPanel.toggleCollapsedLinks(
          !!this.settings.hideLinks
        );

        cb && cb();

        this.processReferences();
      }
    },
    5000,
    true
  );

  processReferences = async () => {
    const { settings } = this;
    const panel = this.shell?.refsPanel;
    if (!settings.pathToBibliography && !settings.pullFromZoteroApi) {
      return panel?.setMessage(
        t(
          'Please provide the path to your pandoc compatible bibliography file in the PandoCit plugin settings.'
        )
      );
    }

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      try {
        const fileContent = await this.app.vault.cachedRead(activeView.file);
        const bib = await this.bibManager.getReferenceList(
          activeView.file,
          fileContent
        );
        const cache = this.bibManager.fileCache.get(activeView.file);

        if (
          !bib &&
          settings.pullFromZoteroApi &&
          this.bibManager.bibCache.size === 0 &&
          cache?.keys.size
        ) {
          panel?.setMessage(t('Zotero library has no items — run Sync'));
        } else {
          panel?.setViewContent(bib);
        }
      } catch (e) {
        console.error(e);
        if (
          e instanceof Error &&
          e.message &&
          e.message.toLowerCase().includes('pandoc.wasm')
        ) {
          panel?.setMessage(
            t(
              'Unable to load pandoc.wasm; reference list is disabled on this platform.'
            )
          );
        }
      }
    } else {
      panel?.setNoContentMessage();
    }
  };
}
