import { Notice } from 'obsidian';

import { t } from '../lang/helpers';
import type ReferenceList from '../main';
import type { VaultPdfImportSettings } from '../settings';
import {
  EXAMPLE_EXCLUDE_FOLDER_GLOBS,
  EXAMPLE_EXCLUDE_PATH_REGEX,
  METADATA_REGEX_EXAMPLES,
  mergeLinesIntoTextarea,
} from './filterExamples';
import { describeActiveImportFilters } from './filterPreview';

function addExampleBlock(
  parent: HTMLElement,
  title: string,
  intro: string,
  code: string,
  insertLabel: string | null,
  onInsert: (() => void) | null
): void {
  const block = parent.createDiv({
    cls: 'pwc-vault-pdf-import-filter-examples__block',
  });
  block.createEl('h4', { text: title });
  block.createEl('p', { text: intro });
  const pre = block.createEl('pre', {
    cls: 'pwc-vault-pdf-import-filter-examples__code',
  });
  pre.setText(code);
  if (insertLabel && onInsert) {
    block
      .createEl('button', {
        text: insertLabel,
        cls: 'mod-small',
      })
      .addEventListener('click', onInsert);
  }
}

function addMetadataExampleBlock(
  parent: HTMLElement,
  title: string,
  intro: string,
  sampleLabel: string,
  sampleNames: string[] | undefined,
  regexLabel: string,
  regex: string,
  insertLabel: string | null,
  onInsert: (() => void) | null
): void {
  const block = parent.createDiv({
    cls: 'pwc-vault-pdf-import-filter-examples__block',
  });
  block.createEl('h4', { text: title });
  block.createEl('p', { text: intro });
  if (sampleNames?.length) {
    block.createEl('p', { text: sampleLabel });
    const ul = block.createEl('ul', {
      cls: 'pwc-vault-pdf-import-filter-examples__meta-samples',
    });
    for (const sample of sampleNames) {
      ul.createEl('li', { text: sample });
    }
  }
  block.createEl('p', { text: regexLabel });
  const pre = block.createEl('pre', {
    cls: 'pwc-vault-pdf-import-filter-examples__code',
  });
  pre.setText(regex);
  if (insertLabel && onInsert) {
    block
      .createEl('button', {
        text: insertLabel,
        cls: 'mod-small',
      })
      .addEventListener('click', onInsert);
  }
}

/** Résumé des filtres actifs (réglages plugin). */
export function appendFilterPreview(
  parent: HTMLElement,
  settings?: VaultPdfImportSettings
): void {
  const box = parent.createDiv({ cls: 'pwc-vault-pdf-import-filter-preview' });
  box.createEl('h4', { text: t('Active import filters') });
  const ul = box.createEl('ul');
  for (const line of describeActiveImportFilters(settings)) {
    ul.createEl('li', { text: line });
  }
}

/** Bloc repliable d’exemples ; insertion optionnelle dans les réglages. */
export function appendFilterExamples(
  parent: HTMLElement,
  plugin: ReferenceList,
  opts?: { allowInsert?: boolean; onInserted?: () => void }
): void {
  const allowInsert = opts?.allowInsert ?? false;
  const details = parent.createEl('details', {
    cls: 'pwc-vault-pdf-import-filter-examples',
  });
  details.createEl('summary', { text: t('Filter examples title') });
  const body = details.createDiv({
    cls: 'pwc-vault-pdf-import-filter-examples__body',
  });
  if (!allowInsert) {
    body.createEl('p', {
      cls: 'pwc-vault-pdf-import-filter-examples__hint',
      text: t('Filter examples modal hint'),
    });
  }

  addExampleBlock(
    body,
    t('Exclude folder globs'),
    t('Filter examples globs intro'),
    EXAMPLE_EXCLUDE_FOLDER_GLOBS.join('\n'),
    allowInsert ? t('Insert example globs') : null,
    allowInsert
      ? () => {
          const current =
            plugin.settings.vaultPdfImport?.excludeFolderGlobs ?? [];
          plugin.settings.vaultPdfImport = {
            ...plugin.settings.vaultPdfImport,
            excludeFolderGlobs: [
              ...new Set([...current, ...EXAMPLE_EXCLUDE_FOLDER_GLOBS]),
            ],
          };
          void plugin.saveSettings();
          new Notice(t('Filter examples added'));
          opts?.onInserted?.();
        }
      : null
  );

  addExampleBlock(
    body,
    t('Exclude path regex'),
    t('Filter examples path regex intro'),
    EXAMPLE_EXCLUDE_PATH_REGEX,
    allowInsert ? t('Insert example path regex') : null,
    allowInsert
      ? () => {
          plugin.settings.vaultPdfImport = {
            ...plugin.settings.vaultPdfImport,
            excludePathRegex: EXAMPLE_EXCLUDE_PATH_REGEX,
          };
          void plugin.saveSettings();
          new Notice(t('Filter examples added'));
          opts?.onInserted?.();
        }
      : null
  );

  for (const ex of METADATA_REGEX_EXAMPLES) {
    addMetadataExampleBlock(
      body,
      t(ex.labelKey),
      t(ex.introKey ?? 'Metadata regex desc'),
      t('Filter example sample filenames'),
      ex.sampleNames,
      t('Filter example regex'),
      ex.value,
      allowInsert ? t('Use this metadata regex') : null,
      allowInsert
        ? () => {
            plugin.settings.vaultPdfImport = {
              ...plugin.settings.vaultPdfImport,
              metadataRegex: {
                source: 'basename',
                pattern: ex.value,
                titleGroup: 'title',
                authorGroup: 'author',
              },
            };
            void plugin.saveSettings();
            new Notice(t('Filter examples added'));
            opts?.onInserted?.();
          }
        : null
    );
  }
}

/** Met à jour une textarea « une ligne par motif » via fusion de lignes. */
export function insertGlobsIntoTextareaValue(current: string): string {
  return mergeLinesIntoTextarea(current, EXAMPLE_EXCLUDE_FOLDER_GLOBS);
}
