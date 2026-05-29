/** Champs verticaux pour la modal d’import (évite le layout horizontal Obsidian Setting). */

export function addVaultPdfImportField(
  parent: HTMLElement,
  opts: { name: string; desc?: string },
  build: (control: HTMLElement) => void
): void {
  const field = parent.createDiv({ cls: 'pwc-vault-pdf-import-field' });
  field.createDiv({ cls: 'pwc-vault-pdf-import-field__name', text: opts.name });
  if (opts.desc) {
    field.createDiv({ cls: 'pwc-vault-pdf-import-field__desc', text: opts.desc });
  }
  const control = field.createDiv({ cls: 'pwc-vault-pdf-import-field__control' });
  build(control);
}

export function addVaultPdfImportDropdown(
  control: HTMLElement,
  options: { value: string; label: string }[],
  value: string,
  onChange: (value: string) => void
): HTMLSelectElement {
  const sel = control.createEl('select', { cls: 'dropdown' });
  for (const o of options) {
    sel.createEl('option', { text: o.label, value: o.value });
  }
  sel.value = value;
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

export function vaultPdfBasename(vaultPath: string): string {
  const parts = vaultPath.split('/');
  return parts[parts.length - 1] ?? vaultPath;
}
