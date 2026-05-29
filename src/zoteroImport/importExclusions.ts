import type { VaultPdfImportSettings } from '../settings';

function globToRegExp(glob: string): RegExp | null {
  const g = glob.trim();
  if (!g) return null;
  try {
    const escaped = g
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '<<<GLOBSTAR>>>')
      .replace(/\*/g, '[^/\\\\]*')
      .replace(/<<<GLOBSTAR>>>/g, '.*')
      .replace(/\?/g, '[^/\\\\]');
    return new RegExp(`^${escaped}$`, 'i');
  } catch {
    return null;
  }
}

export function getVaultPdfImportSettings(
  settings?: VaultPdfImportSettings
): Required<
  Pick<VaultPdfImportSettings, 'includeExtensions' | 'shortPdfMaxPages'>
> &
  VaultPdfImportSettings {
  return {
    includeExtensions: settings?.includeExtensions ?? ['.pdf'],
    shortPdfMaxPages: settings?.shortPdfMaxPages ?? 50,
    ...settings,
  };
}

export function shouldExcludeVaultPath(
  vaultRelativePath: string,
  rules: VaultPdfImportSettings
): boolean {
  const norm = vaultRelativePath.replace(/\\/g, '/');
  const parts = norm.split('/');

  for (const glob of rules.excludeFolderGlobs ?? []) {
    const re = globToRegExp(glob);
    if (!re) continue;
    for (let i = 0; i < parts.length; i++) {
      const segment = parts.slice(0, i + 1).join('/');
      if (re.test(segment) || re.test(parts[i])) return true;
    }
    if (re.test(norm)) return true;
  }

  const pathRe = rules.excludePathRegex?.trim();
  if (pathRe) {
    try {
      if (new RegExp(pathRe, 'i').test(norm)) return true;
    } catch {
      //
    }
  }

  const ext = rules.includeExtensions ?? ['.pdf'];
  const lower = norm.toLowerCase();
  const okExt = ext.some((e) => {
    const x = e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`;
    return lower.endsWith(x);
  });
  return !okExt;
}
