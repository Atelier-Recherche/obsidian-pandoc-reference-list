import { Notice, requestUrl } from 'obsidian';

import { t } from '../lang/helpers';
import type { DocumentAnnotation } from '../annotations/types';
import type ReferenceList from '../main';
import { saveEpubSidecar } from '../readers/epub/epubSidecar';

interface HypothesisAnnotation {
  uri: string;
  text: string;
  highlights?: string[];
  user_info?: { display_name?: string };
  created?: string;
  id: string;
}

export function isHypothesisConfigured(plugin: ReferenceList): boolean {
  return !!plugin.settings.hypothesisApiToken?.trim();
}

function hypothesisAuthHeader(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function importHypothesisForUri(
  plugin: ReferenceList,
  documentUri: string
): Promise<DocumentAnnotation[]> {
  const token = plugin.settings.hypothesisApiToken?.trim();
  if (!token) {
    new Notice(t('Set Hypothesis API token in settings'));
    return [];
  }
  const group = plugin.settings.hypothesisGroup?.trim() || 'public';
  const url = `https://hypothes.is/api/search?uri=${encodeURIComponent(
    documentUri
  )}&group=${encodeURIComponent(group)}`;
  const res = await requestUrl({
    url,
    headers: hypothesisAuthHeader(token),
  });
  if (res.status !== 200) {
    new Notice(t('Hypothesis import failed'));
    return [];
  }
  const data = JSON.parse(res.text) as { rows?: HypothesisAnnotation[] };
  return (data.rows ?? []).map((row) => ({
    id: `hypothesis-${row.id}`,
    source: 'hypothesis' as const,
    text: row.text || (row.highlights?.[0] ?? ''),
    comment: row.user_info?.display_name ?? '',
    created: row.created,
  }));
}

export async function exportAnnotationsToHypothesis(
  plugin: ReferenceList,
  documentUri: string,
  annotations: DocumentAnnotation[]
): Promise<number> {
  const token = plugin.settings.hypothesisApiToken?.trim();
  if (!token) {
    new Notice(t('Set Hypothesis API token in settings'));
    return 0;
  }
  let count = 0;
  for (const ann of annotations) {
    if (ann.source === 'hypothesis') continue;
    const body = {
      uri: documentUri,
      text: ann.text,
      target: [{ source: documentUri, selector: [{ type: 'TextQuoteSelector', exact: ann.text }] }],
    };
    const res = await requestUrl({
      url: 'https://hypothes.is/api/annotations',
      method: 'POST',
      headers: hypothesisAuthHeader(token),
      body: JSON.stringify(body),
    });
    if (res.status >= 200 && res.status < 300) count++;
  }
  return count;
}

export async function mergeHypothesisIntoEpubSidecar(
  plugin: ReferenceList,
  epubVaultPath: string,
  documentUri: string
): Promise<void> {
  const imported = await importHypothesisForUri(plugin, documentUri);
  if (!imported.length) return;
  const { readOrCreateSidecarAnnotations } = await import(
    '../readers/epub/epubSidecar'
  );
  const existing = await readOrCreateSidecarAnnotations(epubVaultPath);
  const ids = new Set(existing.map((a) => a.id));
  const merged = [...existing];
  for (const a of imported) {
    if (!ids.has(a.id)) merged.push(a);
  }
  await saveEpubSidecar(epubVaultPath, merged);
  new Notice(
    `${t('Hypothesis annotations imported')}: ${imported.length}`
  );
}
