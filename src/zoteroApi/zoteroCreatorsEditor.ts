export const ZOTERO_CREATOR_ROLE_VALUES = [
  'author',
  'editor',
  'translator',
  'contributor',
  'seriesEditor',
  'bookAuthor',
  'composer',
  'reviewedAuthor',
] as const;

export type CreatorRowHandle =
  | {
      kind: 'person';
      role: HTMLSelectElement;
      first: HTMLInputElement;
      last: HTMLInputElement;
    }
  | {
      kind: 'singleName';
      role: HTMLSelectElement;
      name: HTMLInputElement;
    };

export type CreatorsEditorMount = {
  getCreators: () => Record<string, unknown>[];
};

/** Libellés i18n pour les options du menu « rôle » */
export const CREATOR_ROLE_I18N_KEYS: Record<string, string> = {
  author: 'Creator role author',
  editor: 'Creator role editor',
  translator: 'Creator role translator',
  contributor: 'Creator role contributor',
  seriesEditor: 'Creator role series editor',
  bookAuthor: 'Creator role book author',
  composer: 'Creator role composer',
  reviewedAuthor: 'Creator role reviewed author',
};

export function mountZoteroCreatorsEditor(
  host: HTMLElement,
  initial: unknown,
  t: (k: string) => string
): CreatorsEditorMount {
  const box = host.createDiv({ cls: 'pwc-zotero-creators' });
  box.createEl('div', {
    cls: 'pwc-zotero-creators-heading',
    text: t('Creators'),
  });

  const rows: CreatorRowHandle[] = [];
  const list = box.createDiv({ cls: 'pwc-zotero-creators-rows' });

  const pushRow = (c?: Record<string, unknown>) => {
    const row = list.createDiv({ cls: 'pwc-zotero-creator-row' });
    const role = row.createEl('select', {
      cls: 'pwc-zotero-creator-role pwc-zotero-edit-input',
    });
    for (const v of ZOTERO_CREATOR_ROLE_VALUES) {
      const labelKey = CREATOR_ROLE_I18N_KEYS[v];
      role.createEl('option', {
        value: v,
        text: labelKey ? t(labelKey) : v,
      });
    }

    const ct = c?.creatorType ? String(c.creatorType) : 'author';
    if (
      ZOTERO_CREATOR_ROLE_VALUES.includes(
        ct as (typeof ZOTERO_CREATOR_ROLE_VALUES)[number]
      )
    ) {
      role.value = ct;
    }

    const nameOnly =
      typeof c?.name === 'string' &&
      c.name.trim().length > 0 &&
      !String(c?.firstName ?? '').trim() &&
      !String(c?.lastName ?? '').trim();

    let handle: CreatorRowHandle;
    if (nameOnly) {
      row.addClass('pwc-zotero-creator-row--single');
      const name = row.createEl('input', {
        type: 'text',
        cls: 'pwc-zotero-edit-input pwc-zotero-creator-name',
        attr: { placeholder: t('Organization or full name') },
        value: String(c?.name ?? ''),
      });
      handle = { kind: 'singleName', role, name };
    } else {
      const first = row.createEl('input', {
        type: 'text',
        cls: 'pwc-zotero-edit-input pwc-zotero-creator-first',
        attr: { placeholder: t('First name') },
        value: String(c?.firstName ?? ''),
      });
      const last = row.createEl('input', {
        type: 'text',
        cls: 'pwc-zotero-edit-input pwc-zotero-creator-last',
        attr: { placeholder: t('Last name') },
        value: String(c?.lastName ?? ''),
      });
      handle = { kind: 'person', role, first, last };
    }
    rows.push(handle);

    const rm = row.createEl('button', {
      type: 'button',
      cls: 'pwc-zotero-creator-remove',
      text: t('Remove'),
    });
    rm.addEventListener('click', () => {
      row.remove();
      const i = rows.indexOf(handle);
      if (i >= 0) rows.splice(i, 1);
    });
  };

  const arr = Array.isArray(initial) ? initial : [];
  if (arr.length === 0) {
    pushRow();
  } else {
    for (const c of arr) {
      if (c && typeof c === 'object') {
        pushRow(c as Record<string, unknown>);
      }
    }
  }

  box.createEl('button', {
    type: 'button',
    cls: 'mod-cta pwc-zotero-creators-add',
    text: t('Add creator'),
  }).addEventListener('click', () => pushRow());

  const getCreators = (): Record<string, unknown>[] => {
    const out: Record<string, unknown>[] = [];
    for (const r of rows) {
      const creatorType = r.role.value || 'author';
      if (r.kind === 'singleName') {
        const name = r.name.value.trim();
        if (name) out.push({ creatorType, name });
      } else {
        const firstName = r.first.value.trim();
        const lastName = r.last.value.trim();
        if (firstName || lastName) {
          out.push({ creatorType, firstName, lastName });
        }
      }
    }
    return out;
  };

  return { getCreators };
}
