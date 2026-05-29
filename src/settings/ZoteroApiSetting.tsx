import React from 'react';
import ReferenceList from 'src/main';
import { Notice } from 'obsidian';
import { SettingItem } from './SettingItem';
import { t } from 'src/lang/helpers';
import { noticeSyncResult } from 'src/zoteroApi/zoteroSync';
import { writeBibtexExportToVault } from 'src/zoteroApi/zoteroToBibtex';
import { appendFilterExamples } from 'src/zoteroImport/filterExamplesUI';
import { listVaultFolderPaths } from 'src/zoteroImport/vaultFolders';

function formatMergeIds(ids: number[] | undefined): string {
  return (ids ?? []).join(', ');
}

function parseMergeGroupIdsFromText(s: string): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const part of s.split(/[\s,;]+/)) {
    const x = part.trim();
    if (!x) continue;
    const n = parseInt(x, 10);
    if (Number.isFinite(n) && n > 0 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

function formatMergeGroupLabels(l: Record<string, string> | undefined): string {
  if (!l || Object.keys(l).length === 0) return '';
  return Object.entries(l)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, name]) => `${id} ${name}`)
    .join('\n');
}

/** Une ligne : `12345 Nom du groupe` ou `12345=Nom du groupe` */
function parseMergeGroupLabelsFromText(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of s.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    let m = t.match(/^(\d+)\s*=\s*(.+)$/);
    if (m) {
      out[m[1]] = m[2].trim();
      continue;
    }
    m = t.match(/^(\d+)\s+(.+)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

export function ZoteroApiSetting({ plugin }: { plugin: ReferenceList }) {
  const [enabled, setEnabled] = React.useState(
    !!plugin.settings.pullFromZoteroApi
  );
  const [apiKey, setApiKey] = React.useState(
    plugin.settings.zoteroApiKey ?? ''
  );
  const [libType, setLibType] = React.useState<'user' | 'group'>(
    plugin.settings.zoteroApiLibraryType ?? 'user'
  );
  const [groupId, setGroupId] = React.useState(
    String(plugin.settings.zoteroApiGroupId ?? '')
  );
  const [userIdDisp, setUserIdDisp] = React.useState(
    plugin.settings.zoteroApiUserId != null
      ? String(plugin.settings.zoteroApiUserId)
      : ''
  );
  const [bibPath, setBibPath] = React.useState(
    plugin.settings.zoteroApiBibExportPath ?? ''
  );
  const [groupChoices, setGroupChoices] = React.useState<
    { id: number; name: string }[]
  >([]);
  const [mergeGroupsText, setMergeGroupsText] = React.useState(
    formatMergeIds(plugin.settings.zoteroApiMergeGroupIds)
  );
  const [mergeGroupLabelsText, setMergeGroupLabelsText] = React.useState(
    formatMergeGroupLabels(plugin.settings.zoteroApiMergeGroupLabels)
  );
  const [vaultFolders, setVaultFolders] = React.useState<string[]>([]);
  const [filterFormVersion, setFilterFormVersion] = React.useState(0);
  const filterExamplesRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setVaultFolders(listVaultFolderPaths(plugin.app));
  }, [plugin]);

  React.useEffect(() => {
    const host = filterExamplesRef.current;
    if (!host || !enabled) return;
    host.empty();
    appendFilterExamples(host, plugin, {
      allowInsert: true,
      onInserted: () => setFilterFormVersion((v) => v + 1),
    });
  }, [enabled, filterFormVersion, plugin]);

  const persistApi = React.useCallback(() => {
    plugin.settings.zoteroApiKey = apiKey.trim() || undefined;
    plugin.settings.zoteroApiLibraryType = libType;
    plugin.settings.zoteroApiGroupId =
      libType === 'group' && groupId.trim()
        ? parseInt(groupId.trim(), 10)
        : undefined;
    plugin.settings.zoteroApiMergeGroupIds =
      libType === 'user'
        ? parseMergeGroupIdsFromText(mergeGroupsText)
        : [];
    plugin.settings.zoteroApiMergeGroupLabels =
      libType === 'user'
        ? parseMergeGroupLabelsFromText(mergeGroupLabelsText)
        : {};
    plugin.saveSettings();
  }, [
    apiKey,
    libType,
    groupId,
    mergeGroupsText,
    mergeGroupLabelsText,
    plugin,
  ]);

  const verifyKey = React.useCallback(async () => {
    persistApi();
    plugin.zoteroSync.updateApiKey();
    const ok = await plugin.zoteroSync.refreshUserIdFromApi();
    if (ok && plugin.settings.zoteroApiUserId != null) {
      setUserIdDisp(String(plugin.settings.zoteroApiUserId));
      new Notice(t('API key OK'));
    } else {
      new Notice(t('Could not validate API key'));
    }
  }, [persistApi, plugin]);

  const loadGroupList = React.useCallback(async () => {
    persistApi();
    plugin.zoteroSync.updateApiKey();
    if (!plugin.settings.zoteroApiUserId) {
      new Notice(t('Verify API key first to load groups'));
      return;
    }
    const list = await plugin.zoteroSync.fetchGroupLibraries();
    setGroupChoices(list);
    const cache = { ...(plugin.settings.zoteroApiGroupNamesCache ?? {}) };
    for (const g of list) cache[String(g.id)] = g.name;
    plugin.settings.zoteroApiGroupNamesCache = cache;
    plugin.saveSettings();
    if (list.length === 0) {
      new Notice(t('No group libraries found'));
    } else {
      new Notice(`${t('Groups loaded')}: ${list.length}`);
    }
  }, [persistApi, plugin]);

  const runSync = React.useCallback(async () => {
    persistApi();
    const r = await plugin.zoteroSync.sync();
    noticeSyncResult(r, t);
    await plugin.bibManager.loadGlobalZoteroApi();
    plugin.bibManager.fileCache.clear();
    plugin.processReferences();
  }, [persistApi, plugin]);

  const exportBib = React.useCallback(async () => {
    const p = bibPath.trim() || plugin.settings.zoteroApiBibExportPath?.trim();
    if (!p) {
      new Notice(t('Set a file path ending in .bib first'));
      return;
    }
    const snap = await plugin.zoteroSync.loadSnapshot();
    const res = await writeBibtexExportToVault(plugin.app, snap, p);
    if (res.ok) {
      new Notice(
        `${t('BibTeX export saved')} (${res.entryCount ?? 0} ${t('entries')}) → ${res.path}`
      );
    } else if (res.error === 'need_bib_extension') {
      new Notice(t('Path must end with .bib'));
    } else {
      new Notice(`${t('Export failed')}: ${res.error ?? ''}`);
    }
  }, [bibPath, plugin]);

  return (
    <>
      <div className="pwc-setting-item setting-item">
        <SettingItem
          name={t('Use Zotero Web API (sync)')}
          description={t(
            'Pull and edit your library via api.zotero.org using an API key. Works on mobile. When enabled, the bibliography file path above is not used unless you override it in frontmatter.'
          )}
        >
          <div
            onClick={() => {
              setEnabled((cur) => {
                const next = !cur;
                plugin.settings.pullFromZoteroApi = next;
                plugin.saveSettings(() => plugin.bibManager.reinit(true));
                return next;
              });
            }}
            className={`checkbox-container${enabled ? ' is-enabled' : ''}`}
          />
        </SettingItem>
      </div>

      {!enabled ? null : (
        <>
          <div className="pwc-setting-item setting-item">
            <SettingItem
              name={t('Zotero API key')}
              description={
                <>
                  {t('Create a key at')}{' '}
                  <a
                    href="https://www.zotero.org/settings/keys/new"
                    target="_blank"
                    rel="noreferrer"
                  >
                    zotero.org/settings/keys
                  </a>
                  . {t('Needs library access and write access to edit items.')}
                </>
              }
            >
              <input
                type="password"
                className="pwc-zotero-api-key"
                spellCheck={false}
                autoComplete="off"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  plugin.settings.zoteroApiKey =
                    e.target.value.trim() || undefined;
                  plugin.saveSettings();
                }}
              />
            </SettingItem>
          </div>

          <div className="pwc-setting-item setting-item">
            <SettingItem
              name={t('Library')}
              description={t('User library or a group library.')}
            >
              <select
                value={libType}
                onChange={(e) => {
                  const v = e.target.value as 'user' | 'group';
                  setLibType(v);
                  plugin.settings.zoteroApiLibraryType = v;
                  plugin.saveSettings(() => plugin.bibManager.reinit(true));
                }}
              >
                <option value="user">{t('My library')}</option>
                <option value="group">{t('Group library')}</option>
              </select>
            </SettingItem>
          </div>

          {libType === 'group' ? (
            <>
              <div className="pwc-setting-item setting-item">
                <SettingItem
                  name={t('Group ID')}
                  description={t('Numeric group ID from the Zotero website URL.')}
                >
                  <input
                    type="text"
                    spellCheck={false}
                    list="pwc-zotero-group-pick"
                    value={groupId}
                    onChange={(e) => {
                      setGroupId(e.target.value);
                      const n = parseInt(e.target.value.trim(), 10);
                      plugin.settings.zoteroApiGroupId = Number.isFinite(n)
                        ? n
                        : undefined;
                      plugin.saveSettings(() => plugin.bibManager.reinit(true));
                    }}
                  />
                  <datalist id="pwc-zotero-group-pick">
                    {groupChoices.map((g) => (
                      <option
                        key={g.id}
                        value={String(g.id)}
                        label={g.name}
                      />
                    ))}
                  </datalist>
                </SettingItem>
              </div>
              <div className="pwc-setting-item setting-item">
                <SettingItem
                  name={t('Load group libraries')}
                  description={t('Fetch groups your API key can access')}
                >
                  <button
                    type="button"
                    className="mod-cta"
                    onClick={() => void loadGroupList()}
                  >
                    {t('Load groups')}
                  </button>
                </SettingItem>
              </div>
            </>
          ) : null}

          {libType === 'user' ? (
            <div className="pwc-setting-item setting-item">
              <SettingItem
                name={t('Merge group libraries (IDs)')}
                description={t(
                  'Comma-separated group IDs to show alongside your library. Load groups to pick names; run Sync for each cache.'
                )}
              >
                <textarea
                  className="pwc-zotero-merge-groups"
                  spellCheck={false}
                  rows={2}
                  placeholder="12345, 67890"
                  value={mergeGroupsText}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMergeGroupsText(v);
                    plugin.settings.zoteroApiMergeGroupIds =
                      parseMergeGroupIdsFromText(v);
                    plugin.saveSettings(() => plugin.bibManager.reinit(true));
                  }}
                />
              </SettingItem>
            </div>
          ) : null}

          {libType === 'user' ? (
            <div className="pwc-setting-item setting-item">
              <SettingItem
                name={t('Merge group display names (optional)')}
                description={t(
                  'One line per merged group: numeric ID and display name (or ID=name). Shown in the library panel and collections; overrides names from Load groups when set.'
                )}
              >
                <textarea
                  className="pwc-zotero-merge-groups"
                  spellCheck={false}
                  rows={3}
                  placeholder={'6538473 Mon équipe\n123456=Labo'}
                  value={mergeGroupLabelsText}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMergeGroupLabelsText(v);
                    plugin.settings.zoteroApiMergeGroupLabels =
                      parseMergeGroupLabelsFromText(v);
                    plugin.saveSettings(() => plugin.bibManager.reinit(true));
                  }}
                />
              </SettingItem>
            </div>
          ) : null}

          <div className="pwc-setting-item setting-item">
            <SettingItem
              name={t('Linked user ID')}
              description={t(
                'Filled automatically after verifying the API key.'
              )}
            >
              <span className="pwc-zotero-user-id">{userIdDisp || '—'}</span>
            </SettingItem>
          </div>

          <div className="pwc-setting-item setting-item">
            <SettingItem name={t('Verify API key')}>
              <button
                type="button"
                className="mod-cta"
                onClick={() => void verifyKey()}
              >
                {t('Verify')}
              </button>
            </SettingItem>
          </div>

          <div className="pwc-setting-item setting-item">
            <SettingItem
              name={t('Sync library now')}
              description={t('Download remote changes and upload local edits.')}
            >
              <button
                type="button"
                className="mod-cta"
                onClick={() => void runSync()}
              >
                {t('Sync now')}
              </button>
            </SettingItem>
          </div>

          <div className="pwc-setting-item setting-item">
            <SettingItem
              name={t('Export BibTeX (.bib)')}
              description={
                <>
                  {t(
                    'The synced JSON stores every Zotero object (PDFs, notes, annotations, trash). The .bib export only includes top-level works — like Zotero’s own bibliography export.'
                  )}
                </>
              }
            >
              <input
                type="text"
                spellCheck={false}
                className="pwc-zotero-bib-path"
                placeholder="Ma-bibliotheque-api.bib"
                value={bibPath}
                onChange={(e) => {
                  const v = e.target.value;
                  setBibPath(v);
                  plugin.settings.zoteroApiBibExportPath = v.trim() || undefined;
                  plugin.saveSettings();
                }}
              />
              <button
                type="button"
                className="mod-cta"
                style={{ marginTop: 8 }}
                onClick={() => void exportBib()}
              >
                {t('Export .bib now')}
              </button>
            </SettingItem>
          </div>

          <div className="pwc-setting-item setting-item pwc-setting-item-wrapper pwc-vault-pdf-import-settings">
            <SettingItem
              name={t('Vault PDF import settings')}
              desc={t('Vault folder import desc')}
            >
              <div className="pwc-vault-pdf-import-settings__fields">
                <div className="pwc-vault-pdf-import-settings__field">
                  <label className="setting-item-name">
                    {t('Default documents folder')}
                  </label>
                  <p className="setting-item-description">
                    {t('Default documents folder desc')}
                  </p>
                  <select
                    className="dropdown pwc-vault-pdf-import-settings__select"
                    value={
                      plugin.settings.vaultPdfImport?.defaultVaultFolder ?? ''
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      plugin.settings.vaultPdfImport = {
                        ...plugin.settings.vaultPdfImport,
                        defaultVaultFolder: v || undefined,
                      };
                      void plugin.saveSettings();
                    }}
                  >
                    <option value="">{t('Choose folder')}</option>
                    {vaultFolders.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pwc-vault-pdf-import-settings__field">
                  <label className="setting-item-name">
                    {t('Short PDF max pages')}
                  </label>
                  <input
                    type="number"
                    className="pwc-zotero-edit-input"
                    min={1}
                    defaultValue={
                      plugin.settings.vaultPdfImport?.shortPdfMaxPages ?? 50
                    }
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      plugin.settings.vaultPdfImport = {
                        ...plugin.settings.vaultPdfImport,
                        shortPdfMaxPages: Number.isFinite(n) ? n : 50,
                      };
                      void plugin.saveSettings();
                    }}
                  />
                </div>
                <div className="pwc-vault-pdf-import-settings__field">
                  <label className="setting-item-name">
                    {t('Exclude folder globs')}
                  </label>
                  <p className="setting-item-description">
                    {t('Exclude folder globs desc')}
                  </p>
                  <textarea
                    key={`exclude-globs-${filterFormVersion}`}
                    className="pwc-zotero-edit-input"
                    rows={3}
                    defaultValue={(
                      plugin.settings.vaultPdfImport?.excludeFolderGlobs ?? []
                    ).join('\n')}
                    onChange={(e) => {
                      const lines = e.target.value
                        .split(/\r?\n/)
                        .map((l) => l.trim())
                        .filter(Boolean);
                      plugin.settings.vaultPdfImport = {
                        ...plugin.settings.vaultPdfImport,
                        excludeFolderGlobs: lines,
                      };
                      void plugin.saveSettings();
                    }}
                  />
                </div>
                <div className="pwc-vault-pdf-import-settings__field">
                  <label className="setting-item-name">
                    {t('Exclude path regex')}
                  </label>
                  <p className="setting-item-description">
                    {t('Exclude path regex desc')}
                  </p>
                  <input
                    key={`exclude-path-${filterFormVersion}`}
                    type="text"
                    className="pwc-zotero-edit-input"
                    defaultValue={
                      plugin.settings.vaultPdfImport?.excludePathRegex ?? ''
                    }
                    onChange={(e) => {
                      plugin.settings.vaultPdfImport = {
                        ...plugin.settings.vaultPdfImport,
                        excludePathRegex: e.target.value.trim() || undefined,
                      };
                      void plugin.saveSettings();
                    }}
                  />
                </div>
                <div className="pwc-vault-pdf-import-settings__field">
                  <label className="setting-item-name">
                    {t('Metadata regex pattern')}
                  </label>
                  <p className="setting-item-description">
                    {t('Metadata regex desc')}
                  </p>
                  <input
                    key={`metadata-regex-${filterFormVersion}`}
                    type="text"
                    className="pwc-zotero-edit-input"
                    defaultValue={
                      plugin.settings.vaultPdfImport?.metadataRegex?.pattern ?? ''
                    }
                    onChange={(e) => {
                      plugin.settings.vaultPdfImport = {
                        ...plugin.settings.vaultPdfImport,
                        metadataRegex: {
                          ...plugin.settings.vaultPdfImport?.metadataRegex,
                          source: 'basename',
                          pattern: e.target.value,
                        },
                      };
                      void plugin.saveSettings();
                    }}
                  />
                </div>
                <div className="pwc-vault-pdf-import-settings__field">
                  <label className="setting-item-name">
                    {t('Default attachment mode')}
                  </label>
                  <select
                    className="dropdown pwc-vault-pdf-import-settings__select"
                    defaultValue={
                      plugin.settings.vaultPdfImport?.defaultAttachmentMode ?? 'link'
                    }
                    onChange={(e) => {
                      plugin.settings.vaultPdfImport = {
                        ...plugin.settings.vaultPdfImport,
                        defaultAttachmentMode: e.target.value as 'link' | 'upload',
                      };
                      void plugin.saveSettings();
                    }}
                  >
                    <option value="link">{t('Link to vault file')}</option>
                    <option value="upload">{t('Upload to Zotero')}</option>
                  </select>
                </div>
                <div
                  ref={filterExamplesRef}
                  className="pwc-vault-pdf-import-settings__examples-host"
                />
              </div>
            </SettingItem>
          </div>
        </>
      )}
    </>
  );
}
