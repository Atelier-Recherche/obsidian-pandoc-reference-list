import { TFile, setIcon } from 'obsidian';

import { citationInfoUsesTap } from './helpers';
import { openPdfForPlugin } from './readers/openDocument';
import { t } from './lang/helpers';
import ReferenceList from './main';
import clip from 'text-clipper';

/** Extrait un numéro de page typique du locator Pandoc (ex. `p78`, `pp. 12-14`). */
function pageNumberFromLocator(loc: string): number | null {
  const m = loc.trim().match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

export class TooltipManager {
  plugin: ReferenceList;
  tooltip: HTMLDivElement;
  isHoveringTooltip = false;
  isScrollBound = false;
  /** Citation épinglée au tap (mobile / pas de survol). */
  pinnedCiteEl: HTMLElement | null = null;
  private outsideDismiss: ((evt: Event) => void) | null = null;

  constructor(plugin: ReferenceList) {
    this.plugin = plugin;
    plugin.register(() => this.hideTooltip());
  }

  static syncTapModeBodyClass(showTooltips: boolean) {
    document.body.toggleClass(
      'pwc-cite-tap-mode',
      !!showTooltips && citationInfoUsesTap()
    );
  }

  showTooltip(el: HTMLElement) {
    if (this.tooltip) {
      this.hideTooltip();
    }

    if (!el.dataset.source) return;

    const file = app.vault.getAbstractFileByPath(el.dataset.source);
    if (!file || !(file instanceof TFile)) {
      return;
    }

    el.win.clearTimeout(this.previewDBTimer);
    el.win.clearTimeout(this.previewDBTimerClose);

    const keys = el.dataset.citekey.split('|');

    let content: DocumentFragment | HTMLElement = null;

    if (el.dataset.noteIndex) {
      content = createDiv();
      const html = this.plugin.bibManager.getNoteForNoteIndex(
        file as TFile,
        el.dataset.noteIndex
      );
      content.append(...html);
    } else {
      for (const key of keys) {
        const html = this.plugin.bibManager.getBibForCiteKey(
          file as TFile,
          key
        ) as HTMLElement;

        if (html) {
          if (!content) content = createFragment();
          if (keys.length > 1) {
            let target = html.find('.csl-right-inline');
            if (!target) target = html.find('.csl-entry');
            if (!target) target = html;
            const inner = target.innerHTML;
            const clipped = clip(inner, 100, { html: true });
            target.innerHTML = clipped;
          }
          content.append(html);
        }
      }
    }

    const modClasses = this.plugin.settings.hideLinks ? ' collapsed-links' : '';
    const tooltip = (this.tooltip = el.doc.body.createDiv({
      cls: `pwc-tooltip${modClasses}`,
    }));
    const rect = el.getBoundingClientRect();

    if (rect.x === 0 && rect.y === 0) {
      return this.hideTooltip();
    }

    if (this.plugin.settings.hideLinks) {
      tooltip.addClass('collapsed-links');
    }

    if (content) {
      tooltip.append(content);
      this.appendZoteroQuickActions(tooltip, el, file.path);
    } else {
      tooltip.addClass('is-missing');
      tooltip.createEl('em', {
        text: t('No citation found for ') + el.dataset.citekey,
      });
    }

    tooltip.addEventListener('pointerover', () => {
      this.isHoveringTooltip = true;
    });
    tooltip.addEventListener('pointerout', () => {
      this.isHoveringTooltip = false;
    });
    tooltip.addEventListener('click', (evt) => {
      if (evt.targetNode.instanceOf(HTMLElement)) {
        if (
          evt.targetNode.tagName === 'A' ||
          evt.targetNode.hasClass('clickable-icon') ||
          evt.targetNode.closest('.pwc-tooltip-cite-btn')
        ) {
          if (!this.pinnedCiteEl) this.hideTooltip();
        }
      }
    });

    el.win.setTimeout(() => {
      const viewport = el.win.visualViewport;
      const divRect = tooltip.getBoundingClientRect();

      tooltip.style.left =
        rect.x + divRect.width + 10 > viewport.width
          ? `${rect.x - (rect.x + divRect.width + 10 - viewport.width)}px`
          : `${rect.x}px`;
      tooltip.style.top =
        rect.bottom + divRect.height + 10 > viewport.height
          ? `${rect.y - divRect.height - 5}px`
          : `${rect.bottom + 5}px`;
    });

    this.isScrollBound = true;
    this.boundScroll = () => {
      if (this.isScrollBound) {
        this.hideTooltip();
      }
    };
    el.win.addEventListener('scroll', this.boundScroll, { capture: true });
  }

  /** Boutons Zotero / PDF local (page) sous l’aperçu CSL — uniquement si source API. */
  private appendZoteroQuickActions(
    tooltip: HTMLElement,
    el: HTMLElement,
    sourcePath: string
  ) {
    const citekeyRaw = el.dataset.citekey;
    if (!citekeyRaw) return;
    const primaryKey = citekeyRaw.split('|')[0];
    const zLink = this.plugin.bibManager.zCitekeyToLinks.get(primaryKey);
    const pdfPaths =
      this.plugin.bibManager.zCitekeyToPDFLinks.get(primaryKey) ?? [];
    const webUrls =
      this.plugin.bibManager.zCitekeyToWebLinks.get(primaryKey) ?? [];
    const loc = el.dataset.citeLocator;
    const page = loc ? pageNumberFromLocator(loc) : null;

    if (!zLink && !pdfPaths.length && !webUrls.length) return;

    const bar = tooltip.createDiv({ cls: 'pwc-tooltip-cite-actions' });
    if (zLink) {
      bar.createDiv(
        {
          cls: 'pwc-tooltip-cite-btn clickable-icon',
          attr: { 'aria-label': t('Open in Zotero') },
        },
        (div) => {
          setIcon(div, 'lucide-external-link');
          div.onClickEvent((evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            activeWindow.open(zLink, '_blank');
            this.hideTooltip();
          });
        }
      );
    }
    if (pdfPaths.length) {
      const absPath = pdfPaths[0];
      bar.createDiv(
        {
          cls: 'pwc-tooltip-cite-btn clickable-icon',
          attr: {
            'aria-label':
              page != null
                ? t('Open PDF at cited page')
                : t('Open linked PDF'),
          },
        },
        (div) => {
          setIcon(div, 'lucide-file-text');
          div.onClickEvent((evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            void openPdfForPlugin(
              this.plugin,
              absPath,
              sourcePath,
              page,
              this.plugin.settings.openPdfLinksInNewTab === false
                ? false
                : 'tab'
            );
            this.hideTooltip();
          });
        }
      );
    }
    for (const url of webUrls) {
      bar.createDiv(
        {
          cls: 'pwc-tooltip-cite-btn clickable-icon',
          attr: { 'aria-label': `${t('Web link')}: ${url}` },
        },
        (div) => {
          setIcon(div, 'globe');
          div.onClickEvent((evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            activeWindow.open(url, '_blank');
            this.hideTooltip();
          });
        }
      );
    }
  }

  boundScroll: () => void;

  hideTooltip() {
    this.isHoveringTooltip = false;
    this.isScrollBound = false;
    if (this.outsideDismiss && this.pinnedCiteEl) {
      const doc = this.pinnedCiteEl.doc ?? document;
      doc.removeEventListener('pointerdown', this.outsideDismiss, {
        capture: true,
      });
    }
    this.outsideDismiss = null;
    this.pinnedCiteEl = null;
    this.tooltip?.win.removeEventListener('scroll', this.boundScroll);
    this.tooltip?.remove();
    this.tooltip = null;
    this.boundScroll = null;
  }

  private showTooltipPinned(el: HTMLElement) {
    this.pinnedCiteEl = el;
    this.showTooltip(el);
    const doc = el.doc ?? document;
    this.outsideDismiss = (evt: Event) => {
      const target = evt.target;
      if (!(target instanceof Node)) return;
      if (this.tooltip?.contains(target) || el.contains(target)) return;
      this.hideTooltip();
    };
    doc.addEventListener('pointerdown', this.outsideDismiss, { capture: true });
  }

  private togglePinnedTooltip(el: HTMLElement) {
    if (this.tooltip && this.pinnedCiteEl === el) {
      this.hideTooltip();
      return;
    }
    this.hideTooltip();
    this.showTooltipPinned(el);
  }

  previewDBTimer = 0;
  previewDBTimerClose = 0;
  bindCitationInteraction(el: HTMLElement) {
    if (!this.plugin.settings.showCitekeyTooltips) return;

    if (citationInfoUsesTap()) {
      el.addClass('pwc-cite-tappable');
      el.setAttr('role', 'button');
      el.setAttr('aria-label', t('Show citation info'));
      el.addEventListener('click', (evt) => {
        if (!el.dataset.citekey || el.hasClass('is-link')) return;
        evt.preventDefault();
        evt.stopPropagation();
        this.togglePinnedTooltip(el);
      });
      return;
    }

    this.bindHoverCitationHandler(el);
  }

  private bindHoverCitationHandler(el: HTMLElement) {
    el.addEventListener('pointerover', (evt) => {
      evt.view.clearTimeout(this.previewDBTimer);
      evt.view.clearTimeout(this.previewDBTimerClose);
      this.previewDBTimer = evt.view.setTimeout(() => {
        this.showTooltip(el);
      }, this.plugin.settings.tooltipDelay);
    });

    el.addEventListener('pointerout', (evt) => {
      evt.view.clearTimeout(this.previewDBTimer);
      if (!this.tooltip) return;
      this.previewDBTimerClose = evt.view.setTimeout(() => {
        if (this.isHoveringTooltip) {
          this.handleToolipHover();
        } else {
          this.hideTooltip();
        }
      }, 150);
    });
  }

  handleToolipHover() {
    if (this.isHoveringTooltip) {
      const { tooltip } = this;
      const outhandler = (evt: PointerEvent) => {
        evt.view.clearTimeout(this.previewDBTimerClose);
        this.previewDBTimerClose = evt.view.setTimeout(() => {
          tooltip.removeEventListener('pointerout', outhandler);
          tooltip.removeEventListener('pointerenter', outhandler);
          if (this.isHoveringTooltip) {
            this.handleToolipHover();
          } else {
            this.hideTooltip();
          }
        }, 150);
      };
      const enterHandler = (evt: PointerEvent) => {
        evt.view.clearTimeout(this.previewDBTimerClose);
      };
      tooltip.addEventListener('pointerout', outhandler);
      tooltip.addEventListener('pointerenter', enterHandler);
    }
  }

  /** @deprecated Utiliser bindCitationInteraction */
  bindPreviewTooltipHandler(el: HTMLElement) {
    this.bindCitationInteraction(el);
  }

  getEditorTooltipHandler() {
    const useTap = citationInfoUsesTap();
    let dbOverTimer = 0;
    let dbOutTimer = 0;
    let isClosing = false;
    let activeKey: string;

    return {
      scroll: (evt: UIEvent) => {
        if (activeKey || this.pinnedCiteEl) {
          evt.view?.clearTimeout(dbOutTimer);
          evt.view?.clearTimeout(dbOverTimer);
          activeKey = null;
          this.hideTooltip();
        }
      },
      click: useTap
        ? (evt: MouseEvent) => {
            let target = evt.target as HTMLElement | null;
            while (target && !target.dataset.citekey) {
              target = target.parentElement;
            }
            if (!target?.dataset.citekey || target.hasClass('is-link')) {
              return false;
            }
            evt.preventDefault();
            evt.stopPropagation();
            this.togglePinnedTooltip(target);
            activeKey = target.dataset.citekey;
            return true;
          }
        : undefined,
      pointerover: useTap
        ? undefined
        : (evt: PointerEvent) => {
        const target = evt.targetNode;
        if (target.instanceOf(HTMLElement)) {
          const citekey = target.dataset.citekey;
          if (citekey) {
            evt.view.clearTimeout(dbOutTimer);
            isClosing = false;
            if (citekey !== activeKey) {
              if (activeKey) {
                this.hideTooltip();
                activeKey = null;
              }
              evt.view.clearTimeout(dbOverTimer);
              dbOverTimer = evt.view.setTimeout(() => {
                this.showTooltip(target);
                activeKey = citekey;
              }, this.plugin.settings.tooltipDelay);
            }
            return;
          }
        }
        evt.view.clearTimeout(dbOverTimer);
        if (activeKey && !isClosing) {
          if (!this.tooltip) return;
          isClosing = true;
          dbOutTimer = evt.view.setTimeout(() => {
            if (this.isHoveringTooltip) {
              isClosing = false;
            } else {
              this.hideTooltip();
              activeKey = null;
              isClosing = false;
            }
          }, 150);
        }
      },
    } as Record<string, ((evt: any) => boolean | void) | undefined>;
  }
}
