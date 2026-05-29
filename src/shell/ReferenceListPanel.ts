import { setIcon } from 'obsidian';

import { copyElToClipboard } from '../helpers';
import { t } from '../lang/helpers';
import type ReferenceList from '../main';

/** Reference list content for the shell « Références » tab */
export class ReferenceListPanel {
  private host: HTMLElement;
  private contentHost: HTMLElement;

  constructor(host: HTMLElement, private plugin: ReferenceList) {
    this.host = host;
    host.empty();
    host.addClass('pwc-reference-list');
    host.toggleClass('collapsed-links', !!plugin.settings.hideLinks);
    this.contentHost = host.createDiv({ cls: 'pwc-reference-list__body' });
    this.setNoContentMessage();
  }

  toggleCollapsedLinks(collapsed: boolean): void {
    this.host.toggleClass('collapsed-links', collapsed);
  }

  setViewContent(bib: HTMLElement | null): void {
    if (bib && this.contentHost.firstChild !== bib) {
      let count = 0;
      bib.findAll('.csl-entry').forEach(() => {
        count++;
      });

      this.contentHost.empty();
      this.contentHost.createDiv(
        { cls: 'pwc-reference-list__title' },
        (div) => {
          div.createDiv({ text: t('References') });
          div.createDiv({}, (inner) => {
            if (count) {
              inner.createDiv({
                cls: 'pwc-reference-list__count',
                text: count.toString(),
              });
            }
            inner.createDiv(
              {
                cls: 'clickable-icon',
                attr: { 'aria-label': t('Copy list') },
              },
              (btn) => {
                setIcon(btn, 'lucide-copy');
                btn.onClickEvent(() => copyElToClipboard(bib));
              }
            );
          });
        }
      );
      this.contentHost.append(bib);
    } else if (!bib) {
      this.setNoContentMessage();
    }
  }

  setNoContentMessage(): void {
    this.setMessage(t('No citations found in the current document.'));
  }

  setMessage(message: string): void {
    this.contentHost.empty();
    this.contentHost.createDiv({ cls: 'pane-empty', text: message });
  }
}
