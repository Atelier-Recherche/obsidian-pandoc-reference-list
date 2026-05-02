import React from 'react';
import ReferenceList from 'src/main';
import { Notice } from 'obsidian';
import { SettingItem } from './SettingItem';
import { t } from 'src/lang/helpers';
import { noticeSyncResult } from 'src/zoteroApi/zoteroSync';
import { writeBibtexExportToVault } from 'src/zoteroApi/zoteroToBibtex';

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

  const persistApi = React.useCallback(() => {
    plugin.settings.zoteroApiKey = apiKey.trim() || undefined;
    plugin.settings.zoteroApiLibraryType = libType;
    plugin.settings.zoteroApiGroupId =
      libType === 'group' && groupId.trim()
        ? parseInt(groupId.trim(), 10)
        : undefined;
    plugin.saveSettings();
  }, [apiKey, libType, groupId, plugin]);

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
            <div className="pwc-setting-item setting-item">
              <SettingItem
                name={t('Group ID')}
                description={t('Numeric group ID from the Zotero website URL.')}
              >
                <input
                  type="text"
                  spellCheck={false}
                  value={groupId}
                  onChange={(e) => {
                    setGroupId(e.target.value);
                    const n = parseInt(e.target.value.trim(), 10);
                    plugin.settings.zoteroApiGroupId = Number.isFinite(n)
                      ? n
                      : undefined;
                    plugin.saveSettings();
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
        </>
      )}
    </>
  );
}
