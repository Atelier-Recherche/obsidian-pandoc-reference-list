import { Notice, TFile } from 'obsidian';

import { t } from '../lang/helpers';
import { resolveVaultRelativePdfPath } from '../helpers';
import type ReferenceList from '../main';
import { getLinkedFilePathFromAttachmentData } from '../zoteroApi/attachmentLinks';
import { parseStorageItemKey } from '../zoteroApi/zoteroMerge';
import type { ZoteroStoreSnapshot } from '../zoteroApi/types';
import type { DocumentAnnotation, ZoteroAnnotationRow } from './types';
import { resolveTopItemInfo } from './zoteroAnnotationIndex';

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim();
}

function stripPwcMarkers(s: string): string {
  return s.replace(/\[\[PWC:[^\]]+\]\]|\[PWC:[^\]]+\]\]?/g, '').trim();
}

function pageForAnnotation(ann: DocumentAnnotation): string {
  if (ann.pageLabel?.trim()) return ann.pageLabel.trim();
  if (ann.pageIndex != null) return String(ann.pageIndex + 1);
  return '';
}

export function annotationLinkId(ann: DocumentAnnotation): string {
  if (ann.zoteroKey) {
    return parseStorageItemKey(ann.zoteroKey).plainKey;
  }
  if (ann.id.startsWith('pdf-')) return ann.id.slice(4);
  return ann.id;
}

export function formatAnnotationReference(opts: {
  text: string;
  comment: string;
  vaultPath: string;
  page?: string;
  annotationId?: string;
  citekey?: string;
}): string {
  const lines: string[] = [];
  const text = stripPwcMarkers(stripHtml(opts.text));
  const comment = stripPwcMarkers(stripHtml(opts.comment));
  if (text) lines.push(`> ${text}`);

  const page = opts.page?.trim() ?? '';
  const annotId = opts.annotationId?.trim() ?? '';
  let link = `[[${opts.vaultPath}`;
  if (page || annotId) {
    const parts: string[] = [];
    if (page) parts.push(`page=${page}`);
    if (annotId) parts.push(`annotation=${annotId}`);
    link += `#${parts.join('&')}`;
  }
  link += ']]';
  lines.push(link);

  const ck = opts.citekey?.trim();
  if (ck) {
    lines.push(page ? `[@${ck} p${page}]` : `[@${ck}]`);
  }

  if (comment && comment !== text) lines.push(comment);
  return lines.join('\n');
}

export function formatDocumentAnnotationReference(
  ann: DocumentAnnotation,
  vaultPath: string,
  citekey?: string
): string {
  return formatAnnotationReference({
    text: ann.text,
    comment: ann.comment,
    vaultPath,
    page: pageForAnnotation(ann),
    annotationId: annotationLinkId(ann),
    citekey,
  });
}

export function formatZoteroAnnotationRowReference(
  row: ZoteroAnnotationRow,
  vaultPath: string
): string {
  return formatAnnotationReference({
    text: row.annotationText,
    comment: row.annotationComment,
    vaultPath,
    page: row.annotationPageLabel,
    annotationId: parseStorageItemKey(row.key).plainKey,
    citekey: row.citekey,
  });
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

export async function copyAnnotationReferenceNotice(text: string): Promise<void> {
  const ok = await copyTextToClipboard(text);
  new Notice(ok ? t('Annotation reference copied') : t('Copy failed'));
}

export function resolveCitekeyForZoteroAttachment(
  snap: ZoteroStoreSnapshot,
  attachmentKey: string
): string | undefined {
  const st = snap.items[attachmentKey];
  if (!st) return undefined;
  const parentKey = String(st.data.parentItem ?? '');
  if (!parentKey) return undefined;
  const top = resolveTopItemInfo(snap, parentKey);
  return top.citekey?.trim() || undefined;
}

export async function resolveVaultPathForZoteroAttachment(
  plugin: ReferenceList,
  attachmentKey: string
): Promise<string | undefined> {
  const snap = await plugin.zoteroSync.loadSnapshot();
  const st = snap.items[attachmentKey];
  if (!st) return undefined;
  const d = st.data as Record<string, unknown>;
  const linked = getLinkedFilePathFromAttachmentData(d);
  if (linked) {
    const vault = await resolveVaultRelativePdfPath(plugin.app, linked);
    if (vault) return vault;
  }
  const raw = typeof d.path === 'string' ? d.path.trim() : '';
  if (raw && !raw.startsWith('attachments:') && !/^https?:\/\//i.test(raw)) {
    const vault = await resolveVaultRelativePdfPath(plugin.app, raw);
    if (vault) return vault;
  }
  const base =
    (typeof d.title === 'string' && d.title.trim()) ||
    (linked ? linked.split(/[/\\]/).pop() : '') ||
    '';
  if (base) {
    const byName = plugin.app.vault.getFiles().find(
      (f) =>
        f instanceof TFile &&
        f.extension.toLowerCase() === 'pdf' &&
        f.name.toLowerCase() === base.toLowerCase()
    );
    if (byName instanceof TFile) return byName.path;
  }
  return undefined;
}
