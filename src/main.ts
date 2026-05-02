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
import { t } from './lang/helpers';
import { processCiteKeys } from './markdownPostprocessor';
import {
  DEFAULT_SETTINGS,
  ReferenceListSettings,
  ReferenceListSettingsTab,
} from './settings';
import { TooltipManager } from './tooltip';
import { ReferenceListView, viewType } from './view';
import { ZoteroLibraryView, zoteroLibraryViewType } from './zoteroLibraryView';
import { ZoteroSyncService, noticeSyncResult } from './zoteroApi/zoteroSync';
import { writeBibtexExportToVault } from './zoteroApi/zoteroToBibtex';
import { PromiseCapability, getVaultRoot } from './helpers';
import { getPath } from './platformAdapter';
import { BibManager } from './bib/bibManager';
import { CiteSuggest } from './citeSuggest/citeSuggest';

export default class ReferenceList extends Plugin {
  settings: ReferenceListSettings;
  emitter: Events;
  tooltipManager: TooltipManager;
  cacheDir: string;
  bibManager: BibManager;
  zoteroSync: ZoteroSyncService;
  _initPromise: PromiseCapability<void>;

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
      viewType,
      (leaf: WorkspaceLeaf) => new ReferenceListView(leaf, this)
    );
    this.registerView(
      zoteroLibraryViewType,
      (leaf: WorkspaceLeaf) => new ZoteroLibraryView(leaf, this)
    );

    this.zoteroSync = new ZoteroSyncService(this);
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
        } else {
          await this.bibManager.loadGlobalBibFile();
        }
      })
      .finally(() => this.bibManager.initPromise.resolve());

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

    this.initPromise.resolve();
    this.app.workspace.trigger('parse-style-settings');

    this.addCommand({
      id: 'focus-reference-list-view',
      name: t('Show reference list'),
      callback: async () => {
        this.initLeaf();
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
        this.bibManager.reinit(true);
        await this.bibManager.initPromise.promise;
        this.processReferences();
      },
    });

    this.addCommand({
      id: 'zotero-library-panel',
      name: t('Open Zotero library panel'),
      callback: async () => {
        await this.initZoteroLibraryLeaf();
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
                  this.view?.setNoContentMessage();
                }
              }
            });
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
    document.body.removeClass('pwc-tooltips');
    this.app.workspace
      .getLeavesOfType(viewType)
      .forEach((leaf) => leaf.detach());
    this.app.workspace
      .getLeavesOfType(zoteroLibraryViewType)
      .forEach((leaf) => leaf.detach());
    this.bibManager.destroy();
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

  get view() {
    const leaves = this.app.workspace.getLeavesOfType(viewType);
    if (!leaves?.length) return null;
    const maybeView = leaves[0].view;
    if (
      maybeView &&
      typeof (maybeView as any).setViewContent === 'function' &&
      typeof (maybeView as any).setMessage === 'function'
    ) {
      return maybeView as ReferenceListView;
    }
    return null;
  }

  async initLeaf() {
    if (this.view) return this.revealLeaf();

    await this.app.workspace.getRightLeaf(false).setViewState({
      type: viewType,
    });

    this.revealLeaf();

    await this.initPromise.promise;
    await this.bibManager.initPromise.promise;

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      this.processReferences();
    }
  }

  async initZoteroLibraryLeaf() {
    if (!this.settings.pullFromZoteroApi) {
      new Notice(t('Enable “Use Zotero Web API” in plugin settings first'));
      return;
    }
    const leaves = this.app.workspace.getLeavesOfType(zoteroLibraryViewType);
    if (leaves?.length) {
      this.app.workspace.revealLeaf(leaves[0]);
      return;
    }
    await this.app.workspace.getRightLeaf(false).setViewState({
      type: zoteroLibraryViewType,
    });
    const newLeaves = this.app.workspace.getLeavesOfType(zoteroLibraryViewType);
    if (newLeaves?.length) {
      this.app.workspace.revealLeaf(newLeaves[0]);
    }
  }

  revealLeaf() {
    const leaves = this.app.workspace.getLeavesOfType(viewType);
    if (!leaves?.length) return;
    this.app.workspace.revealLeaf(leaves[0]);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(cb?: () => void) {
    document.body.toggleClass(
      'pwc-tooltips',
      !!this.settings.showCitekeyTooltips
    );

    // Refresh the reference list when settings change
    this.emitSettingsUpdate(cb);
    await this.saveData(this.settings);
  }

  emitSettingsUpdate = debounce(
    (cb?: () => void) => {
      if (this.initPromise.settled) {
        this.view?.contentEl.toggleClass(
          'collapsed-links',
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
    const view = this.view;
    if (!settings.pathToBibliography && !settings.pullFromZoteroApi) {
      return view?.setMessage(
        t(
          'Please provide the path to your pandoc compatible bibliography file in the Pandoc Reference List plugin settings.'
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

        const currentView = this.view;

        if (
          !bib &&
          settings.pullFromZoteroApi &&
          this.bibManager.bibCache.size === 0 &&
          cache?.keys.size
        ) {
          currentView?.setMessage(t('Zotero library has no items — run Sync'));
        } else {
          currentView?.setViewContent(bib);
        }
      } catch (e) {
        console.error(e);
        if (
          e instanceof Error &&
          e.message &&
          e.message.toLowerCase().includes('pandoc.wasm')
        ) {
          view?.setMessage(
            t(
              'Unable to load pandoc.wasm; reference list is disabled on this platform.'
            )
          );
        }
      }
    } else {
      view?.setNoContentMessage();
    }
  };
}
