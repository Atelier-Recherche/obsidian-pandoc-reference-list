import { getPath } from '../platformAdapter';
import { getVaultRoot } from '../helpers';

/** Chemin absolu pour une pièce jointe Zotero `linked_file`. */
export function resolveVaultPdfAbsolutePath(input: string): string {
  const v = input.trim();
  if (!v) return '';
  const pathMod = getPath();
  if (pathMod.isAbsolute(v)) return pathMod.normalize(v);
  const root = getVaultRoot();
  if (!root) return v;
  return pathMod.join(root, v.replace(/^[/\\]+/, ''));
}
