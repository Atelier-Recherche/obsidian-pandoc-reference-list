import { TFile, normalizePath } from 'obsidian';

import type { DocumentAnnotation } from '../../annotations/types';

export const SIDECAR_SUFFIX = '.pandocit.ann.json';

export function sidecarPathForEpub(epubVaultPath: string): string {
  return normalizePath(`${epubVaultPath}${SIDECAR_SUFFIX}`);
}

export interface EpubSidecarFile {
  version: 1;
  epubPath: string;
  annotations: DocumentAnnotation[];
}

export async function loadEpubSidecar(
  file: TFile
): Promise<DocumentAnnotation[]> {
  try {
    const raw = await app.vault.read(file);
    const parsed = JSON.parse(raw) as EpubSidecarFile;
    if (!Array.isArray(parsed.annotations)) return [];
    return parsed.annotations.map((a) => ({
      ...a,
      source: a.source ?? 'sidecar',
    }));
  } catch {
    return [];
  }
}

export async function saveEpubSidecar(
  epubPath: string,
  annotations: DocumentAnnotation[]
): Promise<void> {
  const path = sidecarPathForEpub(epubPath);
  const payload: EpubSidecarFile = {
    version: 1,
    epubPath,
    annotations,
  };
  const text = JSON.stringify(payload, null, 2);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, text);
  } else {
    await app.vault.create(path, text);
  }
}

export async function readOrCreateSidecarAnnotations(
  epubPath: string
): Promise<DocumentAnnotation[]> {
  const path = sidecarPathForEpub(epubPath);
  const f = app.vault.getAbstractFileByPath(path);
  if (f instanceof TFile) return loadEpubSidecar(f);
  return [];
}
