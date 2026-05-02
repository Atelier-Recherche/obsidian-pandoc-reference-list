import {
  Notice,
  Platform,
  PluginSettingTab,
  Setting,
  TextComponent,
} from 'obsidian';

import { t } from './lang/helpers';
import ReferenceList from './main';
import ReactDOM from 'react-dom';
import React from 'react';
import { SettingItem } from './settings/SettingItem';
import AsyncSelect from 'react-select/async';
import {
  NoOptionMessage,
  customSelectStyles,
  loadCSLLangOptions,
  loadCSLOptions,
} from './settings/select.helpers';
import { cslListRaw } from './bib/cslList';
import { langListRaw } from './bib/cslLangList';
import { ZoteroApiSetting } from './settings/ZoteroApiSetting';

export const DEFAULT_SETTINGS: ReferenceListSettings = {
  tooltipDelay: 400,
  zoteroGroups: [],
  renderCitations: true,
  renderCitationsReadingMode: true,
  renderLinkCitations: true,
  zoteroApiLibraryType: 'user',
};

export interface ZoteroGroup {
  id: number;
  name: string;
  lastUpdate?: number;
}

export interface ReferenceListSettings {
  pathToBibliography?: string;

  cslStyleURL?: string;
  cslStylePath?: string;
  cslLang?: string;

  hideLinks?: boolean;
  showCitekeyTooltips?: boolean;
  tooltipDelay: number;
  enableCiteKeyCompletion?: boolean;
  renderCitations?: boolean;
  renderCitationsReadingMode?: boolean;
  renderLinkCitations?: boolean;

  pullFromZotero?: boolean;
  zoteroPort?: string;
  zoteroGroups: ZoteroGroup[];

  pullFromZoteroApi?: boolean;
  zoteroApiKey?: string;
  zoteroApiUserId?: number;
  zoteroApiLibraryType?: 'user' | 'group';
  zoteroApiGroupId?: number;
  /** Vault-relative path for optional BibTeX export (Pandoc / LaTeX / Typst) */
  zoteroApiBibExportPath?: string;
}

export class ReferenceListSettingsTab extends PluginSettingTab {
  plugin: ReferenceList;

  constructor(plugin: ReferenceList) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName(t('Path to bibliography file'))
      .setDesc(
        t(
          'The absolute path to your desired bibliography file. This can be overridden on a per-file basis by setting "bibliography" in the file\'s frontmatter.'
        )
      )
      .then((setting) => {
        let input: TextComponent;
        setting.addText((text) => {
          input = text;
          text
            .setValue(this.plugin.settings.pathToBibliography)
            .onChange((value) => {
              const prev = this.plugin.settings.pathToBibliography;
              this.plugin.settings.pathToBibliography = value;
              this.plugin.saveSettings(() => {
                this.plugin.bibManager.clearWatcher(prev);
                this.plugin.bibManager.reinit(true);
              });
            });
        });

        setting.addExtraButton((b) => {
          b.setIcon('folder');
          b.setTooltip(t('Select a bibliography file.'));
          b.onClick(() => {
            if (!Platform.isDesktop) {
              new Notice(
                t(
                  'File selection is only available on desktop. Please enter the path manually.'
                )
              );
              return;
            }

            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const path = require('electron').remote.dialog.showOpenDialogSync(
              {
                properties: ['openFile'],
              }
            );

            if (path && path.length) {
              input.setValue(path[0]);

              this.plugin.settings.pathToBibliography = path[0];
              this.plugin.saveSettings(() =>
                this.plugin.bibManager.reinit(true)
              );
            }
          });
        });
      });

    ReactDOM.render(
      <ZoteroApiSetting plugin={this.plugin} />,
      containerEl.createDiv('setting-item pwc-setting-item-wrapper')
    );

    const defaultStyle = cslListRaw.find(
      (item) => item.value === this.plugin.settings.cslStyleURL
    );

    ReactDOM.render(
      <SettingItem name={t('Citation style')}>
        <AsyncSelect
          noOptionsMessage={NoOptionMessage}
          placeholder={t('Search...')}
          cacheOptions
          className="pwc-multiselect"
          defaultValue={defaultStyle}
          loadOptions={loadCSLOptions}
          isClearable
          onChange={(selection: any) => {
            this.plugin.settings.cslStyleURL = selection?.value;
            this.plugin.saveSettings(() =>
              this.plugin.bibManager.reinit(false)
            );
          }}
          styles={customSelectStyles}
        />
      </SettingItem>,
      containerEl.createDiv('pwc-setting-item setting-item')
    );

    new Setting(containerEl)
      .setName(t('Custom citation style'))
      .setDesc(
        t(
          'Path to a CSL file. This can be an absolute path or one relative to your vault. This will override the style selected above. This can be overridden on a per-file basis by setting "csl" or "citation-style" in the file\'s frontmatter. A URL can be supplied when setting the style via frontmatter.'
        )
      )
      .then((setting) => {
        let input: TextComponent;
        setting.addText((text) => {
          input = text;
          text.setValue(this.plugin.settings.cslStylePath).onChange((value) => {
            this.plugin.settings.cslStylePath = value;
            this.plugin.saveSettings(() =>
              this.plugin.bibManager.reinit(false)
            );
          });
        });

        setting.addExtraButton((b) => {
          b.setIcon('folder');
          b.setTooltip(t('Select a CSL file located on your computer'));
          b.onClick(() => {
            if (!Platform.isDesktop) {
              new Notice(
                t(
                  'File selection is only available on desktop. Please enter the path manually.'
                )
              );
              return;
            }

            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const path = require('electron').remote.dialog.showOpenDialogSync(
              {
                properties: ['openFile'],
              }
            );

            if (path && path.length) {
              input.setValue(path[0]);

              this.plugin.settings.cslStylePath = path[0];
              this.plugin.saveSettings(() =>
                this.plugin.bibManager.reinit(false)
              );
            }
          });
        });
      });

    const defaultLanguage = langListRaw.find(
      (item) => item.value === this.plugin.settings.cslLang
    );

    ReactDOM.render(
      <SettingItem
        name={t('Citation style language')}
        description={
          <>
            {t(
              `This can be overridden on a per-file basis by setting "lang" or "citation-language" in the file's frontmatter. A language code must be used when setting the language via frontmatter.`
            )}{' '}
            <a
              href="https://github.com/citation-style-language/locales/blob/master/locales.json"
              target="_blank"
            >
              {t('See here for a list of available language codes')}
            </a>
            .
          </>
        }
      >
        <AsyncSelect
          noOptionsMessage={NoOptionMessage}
          placeholder={t('Search...')}
          cacheOptions
          className="pwc-multiselect"
          defaultValue={defaultLanguage}
          loadOptions={loadCSLLangOptions}
          isClearable
          onChange={(selection: any) => {
            this.plugin.settings.cslLang = selection.value;
            this.plugin.saveSettings(() =>
              this.plugin.bibManager.reinit(false)
            );
          }}
          styles={customSelectStyles}
        />
      </SettingItem>,
      containerEl.createDiv('pwc-setting-item setting-item')
    );

    new Setting(containerEl)
      .setName(t('Hide links in references'))
      .setDesc(t('Replace links with link icons to save space.'))
      .addToggle((text) =>
        text.setValue(!!this.plugin.settings.hideLinks).onChange((value) => {
          this.plugin.settings.hideLinks = value;
          this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t('Render live preview inline citations'))
      .setDesc(
        t(
          'Convert [@pandoc] citations to formatted inline citations in live preview mode.'
        )
      )
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.renderCitations)
          .onChange((value) => {
            this.plugin.settings.renderCitations = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('Render reading mode inline citations'))
      .setDesc(
        t(
          'Convert [@pandoc] citations to formatted inline citations in reading mode.'
        )
      )
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.renderCitationsReadingMode)
          .onChange((value) => {
            this.plugin.settings.renderCitationsReadingMode = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('Process citations in links'))
      .setDesc(
        t(
          'Include [[@pandoc]] citations in the reference list and format them as inline citations in live preview mode.'
        )
      )
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.renderLinkCitations)
          .onChange((value) => {
            this.plugin.settings.renderLinkCitations = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('Show citekey suggestions'))
      .setDesc(
        t(
          'When enabled, an autocomplete dialog will display when typing citation keys.'
        )
      )
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.enableCiteKeyCompletion)
          .onChange((value) => {
            this.plugin.settings.enableCiteKeyCompletion = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('Show citekey tooltips'))
      .setDesc(
        t(
          'When enabled, hovering over citekeys will open a tooltip containing a formatted citation.'
        )
      )
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.showCitekeyTooltips)
          .onChange((value) => {
            this.plugin.settings.showCitekeyTooltips = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('Tooltip delay'))
      .setDesc(
        t(
          'Set the amount of time (in milliseconds) to wait before displaying tooltips.'
        )
      )
      .addSlider((slider) => {
        slider
          .setDynamicTooltip()
          .setLimits(0, 7000, 100)
          .setValue(this.plugin.settings.tooltipDelay)
          .onChange((value) => {
            this.plugin.settings.tooltipDelay = value;
            this.plugin.saveSettings();
          });
      });
  }
}
