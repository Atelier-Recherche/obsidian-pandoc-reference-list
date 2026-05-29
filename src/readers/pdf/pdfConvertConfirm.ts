import { Modal, Setting } from 'obsidian';

import type ReferenceList from '../../main';

export type PdfConvertChoice = {
  proceed: true;
  deleteSource: boolean;
};

export function askPdfConvertConfirm(
  app: ReferenceList['app'],
  target: 'pdf' | 'zotero'
): Promise<PdfConvertChoice | null> {
  return new Promise((resolve) => {
    const m = new PdfConvertConfirmModal(app, target, resolve);
    m.open();
  });
}

class PdfConvertConfirmModal extends Modal {
  private deleteSource = true;
  private done = false;

  constructor(
    app: ReferenceList['app'],
    private target: 'pdf' | 'zotero',
    private onSubmit: (value: PdfConvertChoice | null) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('pwc-pdf-comment-modal');

    const label =
      this.target === 'zotero'
        ? 'Convertir cette annotation vers Zotero ?'
        : 'Convertir cette annotation vers le PDF ?';
    contentEl.createEl('h3', { text: label });

    new Setting(contentEl)
      .setName('Supprimer l’originale après conversion')
      .setDesc('Décocher pour garder les deux copies.')
      .addToggle((tg) => {
        tg.setValue(this.deleteSource).onChange((v) => {
          this.deleteSource = v;
        });
      });

    const row = contentEl.createDiv({ cls: 'pwc-open-mode-modal__row' });
    row
      .createEl('button', { text: 'Convertir', cls: 'mod-cta' })
      .addEventListener('click', () => {
        this.done = true;
        this.onSubmit({ proceed: true, deleteSource: this.deleteSource });
        this.close();
      });
    row.createEl('button', { text: 'Annuler' }).addEventListener('click', () => {
      this.close();
    });
  }

  onClose(): void {
    if (!this.done) {
      this.onSubmit(null);
    }
    this.contentEl.empty();
  }
}
