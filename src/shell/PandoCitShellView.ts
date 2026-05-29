import { ItemView, WorkspaceLeaf } from 'obsidian';

import { t } from '../lang/helpers';
import type ReferenceList from '../main';
import { ZoteroLibraryPanel } from '../zoteroLibraryView';
import { ReferenceListPanel } from './ReferenceListPanel';
import { DocumentAnnotationsPanel } from './DocumentAnnotationsPanel';
import { shellViewType } from './types';
import type { ShellTab } from './types';

export { shellViewType };

const SHELL_TABS: ShellTab[] = [
  'references',
  'zotero',
  'document-annotations',
];

export class PandoCitShellView extends ItemView {
  plugin: ReferenceList;
  activeTab: ShellTab = 'references';
  private tabsEl: HTMLElement;
  private panelsEl: HTMLElement;
  private panelHosts = new Map<ShellTab, HTMLElement>();
  refsPanel: ReferenceListPanel;
  zoteroPanel: ZoteroLibraryPanel | null = null;
  docPanel: DocumentAnnotationsPanel | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: ReferenceList) {
    super(leaf);
    this.plugin = plugin;
    this.contentEl.addClass('pwc-shell');
    this.tabsEl = this.contentEl.createDiv({ cls: 'pwc-shell__tabs' });
    this.panelsEl = this.contentEl.createDiv({ cls: 'pwc-shell__panels' });

    for (const tab of SHELL_TABS) {
      const host = this.panelsEl.createDiv({
        cls: `pwc-shell__panel pwc-shell__panel--${tab}`,
      });
      this.panelHosts.set(tab, host);
    }

    this.refsPanel = new ReferenceListPanel(
      this.panelHosts.get('references')!,
      plugin
    );
    this.buildTabs();
    const pending = plugin.pendingShellTab;
    this.switchTab(
      pending && SHELL_TABS.includes(pending) ? pending : 'references'
    );
    plugin.pendingShellTab = undefined;
  }

  getViewType(): string {
    return shellViewType;
  }

  getDisplayText(): string {
    return 'PandoCit';
  }

  getIcon(): string {
    return 'quote-glyph';
  }

  private tabLabel(tab: ShellTab): string {
    switch (tab) {
      case 'references':
        return t('References');
      case 'zotero':
        return t('Zotero library');
      case 'document-annotations':
        return t('Document annotations');
    }
  }

  private buildTabs(): void {
    this.tabsEl.empty();
    for (const tab of SHELL_TABS) {
      const btn = this.tabsEl.createEl('button', {
        cls: 'pwc-shell__tab',
        text: this.tabLabel(tab),
        attr: { type: 'button', 'data-tab': tab },
      });
      btn.addEventListener('click', () => this.switchTab(tab));
    }
  }

  switchTab(tab: ShellTab): void {
    this.activeTab = tab;
    this.tabsEl.findAll('.pwc-shell__tab').forEach((el) => {
      el.toggleClass('is-active', el.getAttribute('data-tab') === tab);
    });
    for (const [id, host] of this.panelHosts) {
      host.toggleClass('is-active', id === tab);
    }
    if (tab === 'zotero' && !this.zoteroPanel) {
      if (!this.plugin.settings.pullFromZoteroApi) {
        const host = this.panelHosts.get('zotero')!;
        host.empty();
        host.createDiv({
          cls: 'pane-empty',
          text: t('Enable “Use Zotero Web API” in plugin settings first'),
        });
      } else {
        this.zoteroPanel = new ZoteroLibraryPanel(
          this.panelHosts.get('zotero')!,
          this.plugin
        );
      }
    }
    if (tab === 'document-annotations' && !this.docPanel) {
      this.docPanel = new DocumentAnnotationsPanel(
        this.panelHosts.get('document-annotations')!,
        this.plugin
      );
    }
    if (tab === 'zotero') void this.zoteroPanel?.refreshList();
    if (tab === 'document-annotations') this.docPanel?.render();
  }

  async onOpen(): Promise<void> {
    if (this.activeTab === 'zotero') await this.zoteroPanel?.refreshList();
  }
}
