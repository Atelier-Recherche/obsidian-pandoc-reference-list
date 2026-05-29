import { t } from '../lang/helpers';
import type { VaultPdfImportSettings } from '../settings';
import { getVaultPdfImportSettings } from './importExclusions';

export function describeActiveImportFilters(
  settings?: VaultPdfImportSettings
): string[] {
  const rules = getVaultPdfImportSettings(settings);
  const lines: string[] = [];
  lines.push(
    t('Filter preview extensions').replace(
      '{ext}',
      (rules.includeExtensions ?? ['.pdf']).join(', ')
    )
  );
  lines.push(
    t('Filter preview short pages').replace(
      '{n}',
      String(rules.shortPdfMaxPages)
    )
  );
  const globs = rules.excludeFolderGlobs ?? [];
  if (globs.length) {
    lines.push(`${t('Filter preview exclude globs')}: ${globs.join('; ')}`);
  } else {
    lines.push(t('Filter preview no exclude globs'));
  }
  if (rules.excludePathRegex?.trim()) {
    lines.push(
      `${t('Filter preview path regex')}: ${rules.excludePathRegex.trim()}`
    );
  }
  if (rules.metadataRegex?.pattern?.trim()) {
    lines.push(
      `${t('Filter preview metadata regex')}: ${rules.metadataRegex.pattern.trim()}`
    );
  } else {
    lines.push(t('Filter preview no metadata regex'));
  }
  return lines;
}
