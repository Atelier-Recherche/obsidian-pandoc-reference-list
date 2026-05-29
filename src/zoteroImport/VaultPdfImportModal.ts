import { Modal, Notice, Platform, TFolder } from 'obsidian';

import { t } from '../lang/helpers';
import type ReferenceList from '../main';
import {
  appendFilterExamples,
  appendFilterPreview,
} from './filterExamplesUI';
import { getVaultPdfImportSettings } from './importExclusions';
import { scanVaultFolderForPdfImport } from './vaultPdfScanner';
import { runVaultPdfImport } from './vaultPdfImportRunner';
import type { VaultPdfImportRow } from './types';
import { listVaultFolderPaths } from './vaultFolders';
import {
  addVaultPdfImportDropdown,
  addVaultPdfImportField,
  vaultPdfBasename,
} from './vaultPdfImportModalFields';

type Step = 'folder' | 'review' | 'importing';

const MODAL_SHELL_CLASS = 'pwc-vault-pdf-import-modal-shell';

export class VaultPdfImportModal extends Modal {
  private step: Step = 'folder';
  private folderPath = '';
  private rows: VaultPdfImportRow[] = [];
  private excludedCount = 0;
  private collectionMain = '';
  private collectionShort = '';
  private attachmentMode: 'link' | 'upload' = 'link';
  private collectionOptions: { value: string; label: string }[] = [];
  private progressEl: HTMLElement | null = null;

  constructor(
    private plugin: ReferenceList,
    private onDone?: () => void
  ) {
    super(plugin.app);
  }

  async onOpen(): Promise<void> {
    this.modalEl.addClass(MODAL_SHELL_CLASS);
    this.contentEl.addClass('pwc-vault-pdf-import-modal');
    const rules = getVaultPdfImportSettings(this.plugin.settings.vaultPdfImport);
    this.folderPath =
      this.plugin.settings.vaultPdfImport?.defaultVaultFolder?.trim() ?? '';
    this.attachmentMode =
      rules.defaultAttachmentMode ??
      (Platform.isDesktopApp ? 'link' : 'upload');

    const collMap = await this.plugin.zoteroSync.fetchCollectionNames();
    this.collectionOptions = [
      { value: '', label: t('No collection') },
      ...Array.from(collMap.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
        ),
    ];
    if (this.collectionOptions.length > 1 && !this.collectionMain) {
      this.collectionMain = this.collectionOptions[1]?.value ?? '';
      this.collectionShort = this.collectionOptions[1]?.value ?? '';
    }

    this.render();
  }

  onClose(): void {
    this.modalEl.removeClass(MODAL_SHELL_CLASS);
    this.contentEl.empty();
    this.onDone?.();
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.removeClass('pwc-vault-pdf-import-modal--review');
    if (this.step === 'folder') this.renderFolderStep();
    else if (this.step === 'review') this.renderReviewStep();
    else this.renderImportingStep();
  }

  private renderFolderStep(): void {
    this.contentEl.createEl('h2', { text: t('Vault PDF import title') });
    const body = this.contentEl.createDiv({
      cls: 'pwc-vault-pdf-import-modal__body',
    });

    const folders = listVaultFolderPaths(this.app);
    addVaultPdfImportField(
      body,
      { name: t('Vault folder'), desc: t('Vault folder import desc') },
      (control) => {
        addVaultPdfImportDropdown(
          control,
          [
            { value: '', label: t('Choose folder') },
            ...folders.map((p) => ({ value: p, label: p })),
          ],
          this.folderPath,
          (v) => {
            this.folderPath = v;
          }
        );
      }
    );

    const filtersHost = body.createDiv({
      cls: 'pwc-vault-pdf-import-modal__filters',
    });
    appendFilterPreview(filtersHost, this.plugin.settings.vaultPdfImport);
    appendFilterExamples(filtersHost, this.plugin);

    const actions = this.contentEl.createDiv({
      cls: 'pwc-vault-pdf-import-modal__actions pwc-open-mode-modal__row',
    });
    actions
      .createEl('button', { text: t('Scan folder'), cls: 'mod-cta' })
      .addEventListener('click', () => void this.startScan());
    actions
      .createEl('button', { text: t('Cancel') })
      .addEventListener('click', () => this.close());
  }

  private async startScan(): Promise<void> {
    if (!this.folderPath) {
      new Notice(t('Vault folder required'));
      return;
    }
    const folder = this.app.vault.getAbstractFileByPath(this.folderPath);
    if (!(folder instanceof TFolder)) {
      new Notice(t('Folder not found in vault'));
      return;
    }

    this.contentEl.empty();
    this.contentEl.createEl('h2', { text: t('Scanning PDFs') });
    const body = this.contentEl.createDiv({
      cls: 'pwc-vault-pdf-import-modal__body',
    });
    this.progressEl = body.createDiv({
      cls: 'pwc-vault-pdf-import-progress',
    });
    this.progressEl.setText('…');

    const res = await scanVaultFolderForPdfImport(
      this.plugin,
      this.folderPath,
      (done, total) => {
        if (this.progressEl) {
          this.progressEl.setText(`${done} / ${total}`);
        }
      }
    );

    this.rows = res.rows;
    this.excludedCount = res.excludedCount;
    this.step = 'review';
    this.render();
  }

  private renderReviewStep(): void {
    const rules = getVaultPdfImportSettings(this.plugin.settings.vaultPdfImport);

    this.contentEl.addClass('pwc-vault-pdf-import-modal--review');
    this.contentEl.createEl('h2', { text: t('Vault PDF import review') });
    const body = this.contentEl.createDiv({
      cls: 'pwc-vault-pdf-import-modal__body',
    });
    const options = body.createDiv({
      cls: 'pwc-vault-pdf-import-modal__options',
    });

    options.createDiv({
      cls: 'pwc-vault-pdf-import-summary',
      text: t('Vault PDF import summary')
        .replace('{found}', String(this.rows.length))
        .replace('{excluded}', String(this.excludedCount))
        .replace(
          '{dup}',
          String(this.rows.filter((r) => r.status === 'duplicate').length)
        ),
    });

    options.createDiv({
      cls: 'pwc-vault-pdf-import-threshold-hint',
      text: t('Short PDF collection hint').replace(
        '{n}',
        String(rules.shortPdfMaxPages)
      ),
    });

    addVaultPdfImportField(options, { name: t('Main collection') }, (control) => {
      addVaultPdfImportDropdown(
        control,
        this.collectionOptions,
        this.collectionMain,
        (v) => {
          this.collectionMain = v;
        }
      );
    });

    addVaultPdfImportField(options, { name: t('Short PDF collection') }, (control) => {
      addVaultPdfImportDropdown(
        control,
        this.collectionOptions,
        this.collectionShort,
        (v) => {
          this.collectionShort = v;
        }
      );
    });

    addVaultPdfImportField(options, { name: t('Attachment mode') }, (control) => {
      addVaultPdfImportDropdown(
        control,
        [
          { value: 'link', label: t('Link to vault file') },
          { value: 'upload', label: t('Upload to Zotero') },
        ],
        this.attachmentMode,
        (v) => {
          this.attachmentMode = v as 'link' | 'upload';
        }
      );
    });

    body.createDiv({
      cls: 'pwc-vault-pdf-import-table-label',
      text: t('Vault PDF import table hint'),
    });
    const tableWrap = body.createDiv({
      cls: 'pwc-vault-pdf-import-table-wrap',
    });
    const table = tableWrap.createEl('table', {
      cls: 'pwc-vault-pdf-import-table',
    });
    const head = table.createEl('thead').createEl('tr');
    for (const label of [
      '',
      t('File'),
      t('Pages'),
      t('Title'),
      t('Author'),
      t('Citekey'),
      t('Status'),
    ]) {
      head.createEl('th', { text: label });
    }

    const tbody = table.createEl('tbody');
    for (const row of this.rows) {
      const tr = tbody.createEl('tr');
      if (row.status === 'duplicate') tr.addClass('is-duplicate');
      if (row.status === 'error') tr.addClass('is-error');

      const tdCheck = tr.createEl('td');
      const cb = tdCheck.createEl('input', { type: 'checkbox' });
      cb.checked = row.selected;
      cb.disabled = row.status !== 'new';
      cb.addEventListener('change', () => {
        row.selected = cb.checked;
      });

      const tdFile = tr.createEl('td', { cls: 'pwc-vault-pdf-import-file' });
      tdFile.setText(vaultPdfBasename(row.vaultPath));
      tdFile.setAttr('title', row.vaultPath);

      tr.createEl('td', { text: String(row.pageCount || '—') });

      const tdTitle = tr.createEl('td');
      const titleIn = tdTitle.createEl('input', { type: 'text' });
      titleIn.value = row.title;
      titleIn.addEventListener('input', () => {
        row.title = titleIn.value;
      });

      const tdAuthor = tr.createEl('td');
      const authorIn = tdAuthor.createEl('input', { type: 'text' });
      authorIn.value = row.author;
      authorIn.addEventListener('input', () => {
        row.author = authorIn.value;
      });

      const tdCk = tr.createEl('td');
      const ckIn = tdCk.createEl('input', { type: 'text' });
      ckIn.value = row.citekey;
      ckIn.addEventListener('input', () => {
        row.citekey = ckIn.value;
      });

      tr.createEl('td', {
        text:
          row.status === 'duplicate'
            ? t('Already in Zotero')
            : row.status === 'error'
              ? row.errorMessage ?? t('Error')
              : t('New'),
      });
    }

    const actions = this.contentEl.createDiv({
      cls: 'pwc-vault-pdf-import-modal__actions pwc-open-mode-modal__row',
    });
    actions
      .createEl('button', { text: t('Select all new') })
      .addEventListener('click', () => {
        for (const r of this.rows) {
          if (r.status === 'new') r.selected = true;
        }
        this.render();
      });
    actions
      .createEl('button', {
        text: t('Import selected'),
        cls: 'mod-cta',
      })
      .addEventListener('click', () => void this.runImport());
    actions
      .createEl('button', { text: t('Back') })
      .addEventListener('click', () => {
        this.step = 'folder';
        this.render();
      });
    actions
      .createEl('button', { text: t('Cancel') })
      .addEventListener('click', () => this.close());
  }

  private renderImportingStep(): void {
    this.contentEl.createEl('h2', { text: t('Importing to Zotero') });
    const body = this.contentEl.createDiv({
      cls: 'pwc-vault-pdf-import-modal__body',
    });
    this.progressEl = body.createDiv({
      cls: 'pwc-vault-pdf-import-progress',
    });
  }

  private async runImport(): Promise<void> {
    if (!this.plugin.settings.pullFromZoteroApi) {
      new Notice(t('Enable Zotero Web API in settings'));
      return;
    }
    const selected = this.rows.filter((r) => r.selected && r.status === 'new');
    if (!selected.length) {
      new Notice(t('No PDFs selected for import'));
      return;
    }

    this.step = 'importing';
    this.render();

    const rules = getVaultPdfImportSettings(this.plugin.settings.vaultPdfImport);
    const result = await runVaultPdfImport(this.plugin, {
      rows: this.rows,
      collectionMainKey: this.collectionMain,
      collectionShortKey: this.collectionShort,
      shortPdfMaxPages: rules.shortPdfMaxPages,
      attachmentMode: this.attachmentMode,
      itemType: rules.defaultItemType,
      onProgress: (done, total, path) => {
        if (this.progressEl) {
          this.progressEl.setText(
            `${done} / ${total}${path ? ` — ${path}` : ''}`
          );
        }
      },
    });

    new Notice(
      t('Vault PDF import done')
        .replace('{created}', String(result.created))
        .replace('{failed}', String(result.failed))
        .replace('{skipped}', String(result.skipped))
    );

    if (result.errors.length) {
      console.warn('[PandoCit] Vault PDF import errors', result.errors);
    }

    this.close();
  }
}

export function openVaultPdfImportModal(plugin: ReferenceList): void {
  if (!plugin.settings.pullFromZoteroApi) {
    new Notice(t('Enable Zotero Web API in settings'));
    return;
  }
  const modal = new VaultPdfImportModal(plugin, () => {
    void plugin.bibManager.loadGlobalZoteroApi();
    plugin.shell?.zoteroPanel?.refreshList?.();
  });
  modal.open();
}
