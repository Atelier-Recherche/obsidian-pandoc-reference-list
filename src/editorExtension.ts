import { syntaxTree } from '@codemirror/language';
import { tokenClassNodeProp } from '@codemirror/language';
import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { Tree } from '@lezer/common';
import {
  Keymap,
  editorInfoField,
  editorLivePreviewField,
  livePreviewState,
} from 'obsidian';

import {
  RenderedCitation,
  Segment,
  SegmentType,
  getCitationSegments,
  getSegmentData,
} from './parser/parser';
import { BibManager, FileCache } from './bib/bibManager';
import equal from 'fast-deep-equal';
import { TooltipManager } from './tooltip';
import { citationInsideInlineFootnote } from './footnoteUtils';

const ignoreListRegEx = /code|math|templater|hashtag/;

function citationHoverAttrs(
  citekey: string,
  sourceFile: string | undefined,
  locator?: string
): Record<string, string> {
  const attr: Record<string, string> = {
    'data-citekey': citekey,
    'data-source': sourceFile || '',
  };
  if (locator?.trim()) attr['data-cite-locator'] = locator.trim();
  return attr;
}

const citeMark = (
  citekey: string,
  sourceFile: string | undefined,
  isResolved: boolean,
  isUnresolved: boolean,
  noteIndex?: string,
  locator?: string
) => {
  const cls = ['cm-pandoc-citation', 'pandoc-citation'];

  if (isResolved) cls.push('is-resolved');
  if (isUnresolved) cls.push('is-unresolved');

  const attr: Record<string, string> = citationHoverAttrs(
    citekey,
    sourceFile,
    locator
  );

  if (noteIndex) attr.noteIndex = noteIndex;

  return Decoration.mark({
    class: cls.join(' '),
    attributes: attr,
  });
};

const citeMarkFormatting = (type: string) => {
  return Decoration.mark({
    class: `cm-pandoc-citation-formatting ${type}`,
  });
};

const citeMarkExtra = (
  type: string,
  dataAttrs?: Record<string, string>
) => {
  return Decoration.mark({
    class: `cm-pandoc-citation-extra ${type}`,
    attributes: dataAttrs,
  });
};

export function editorTooltipHandler(manager: TooltipManager) {
  return EditorView.domEventHandlers(manager.getEditorTooltipHandler());
}

function findInlineFootnoteTextSibling(el: HTMLElement): HTMLElement | null {
  const isFootnoteText = (node: Element | null): node is HTMLElement =>
    node instanceof HTMLElement &&
    node.classList.contains('cm-inline-footnote') &&
    !node.classList.contains('cm-inline-footnote-start') &&
    !node.classList.contains('cm-inline-footnote-end');

  let node = el.previousElementSibling;
  while (node) {
    if (isFootnoteText(node)) return node;
    if (!node.classList.contains('cm-widgetBuffer')) return null;
    node = node.previousElementSibling;
  }

  node = el.nextElementSibling;
  while (node) {
    if (isFootnoteText(node)) return node;
    if (!node.classList.contains('cm-widgetBuffer')) return null;
    node = node.nextElementSibling;
  }

  return null;
}

function syncInlineFootnoteTypography(el: HTMLElement) {
  const ref = findInlineFootnoteTextSibling(el);
  if (!ref) return;

  const computed = activeWindow.getComputedStyle(ref);
  el.style.fontSize = computed.fontSize;
  el.style.lineHeight = computed.lineHeight;
  el.style.fontWeight = computed.fontWeight;
}

class CiteWidget extends WidgetType {
  cite: RenderedCitation;
  sourcePath?: string;
  linkText?: string;
  inInlineFootnote: boolean;

  constructor(
    cite: RenderedCitation,
    sourcePath?: string,
    linkText?: string,
    inInlineFootnote = false
  ) {
    super();
    this.cite = cite;
    this.sourcePath = sourcePath;
    this.linkText = linkText;
    this.inInlineFootnote = inInlineFootnote;
  }

  eq(widget: this): boolean {
    return (
      this.cite === widget.cite &&
      this.inInlineFootnote === widget.inInlineFootnote
    );
  }

  toDOM() {
    const attr: Record<string, string> = {
      'data-citekey': this.cite.citations.map((c) => c.id).join('|'),
      'data-source': this.sourcePath,
    };

    if (this.cite.note) {
      attr['data-note-index'] = this.cite.noteIndex.toString();
    }

    const loc0 = this.cite.citations[0]?.locator;
    if (typeof loc0 === 'string' && loc0.trim()) {
      attr['data-cite-locator'] = loc0.trim();
    }

    const cls = ['pandoc-citation', 'is-resolved'];
    if (this.inInlineFootnote) {
      cls.push('is-in-inline-footnote', 'cm-footref', 'cm-inline-footnote');
    }

    return createSpan(
      {
        cls: cls.join(' '),
        attr,
      },
      (span) => {
        if (this.linkText) {
          span.addClass('is-link');
          span.addEventListener('click', (evt) => {
            const newPane = Keymap.isModEvent(evt);
            activeWindow.setTimeout(() => {
              app.workspace.openLinkText(
                this.linkText,
                this.sourcePath,
                newPane
              );
            }, 100);
          });
        }

        if (/</.test(this.cite.val)) {
          const parsed = new DOMParser().parseFromString(
            this.cite.val,
            'text/html'
          );
          span.append(...Array.from(parsed.body.childNodes));
        } else {
          span.setText(this.cite.val);
        }

        if (this.inInlineFootnote) {
          activeWindow.requestAnimationFrame(() => {
            syncInlineFootnoteTypography(span);
          });
        }
      }
    );
  }

  ignoreEvent(): boolean {
    return false;
  }
}

const citeDeco = (
  cite: RenderedCitation,
  sourcePath?: string,
  linkText?: string,
  inInlineFootnote = false
) =>
  Decoration.replace({
    widget: new CiteWidget(cite, sourcePath, linkText, inInlineFootnote),
  });

function onlyValType(segs: Segment[]) {
  return segs.map((s) => ({ type: s.type, val: s.val }));
}

export const citeKeyPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.mkDeco(view);
    }
    update(update: ViewUpdate) {
      if (
        update.viewportChanged ||
        update.docChanged ||
        update.transactions.some((tr) =>
          tr.effects.some(
            (e) =>
              e.is(setCiteKeyCache) || e.value?.field === editorLivePreviewField
          )
        ) ||
        (update.view.state.field(editorLivePreviewField) &&
          update.selectionSet &&
          !update.view.plugin(livePreviewState)?.mousedown)
      ) {
        this.decorations = this.mkDeco(update.view);
      }
    }
    mkDeco(view: EditorView) {
      const {
        plugin: { settings },
      } = view.state.field(bibManagerField);

      const b = new RangeSetBuilder<Decoration>();
      const obsView = view.state.field(editorInfoField);
      const citekeyCache = view.state.field(citeKeyCacheField);
      const isLivePreview =
        settings.renderCitations && view.state.field(editorLivePreviewField);

      // Don't get the syntax tree until we have to
      let tree: Tree;

      for (const { from, to } of view.visibleRanges) {
        const range = view.state.sliceDoc(from, to);
        const segments = getCitationSegments(
          range,
          !settings.renderLinkCitations
        );

        for (const match of segments) {
          if (!tree) tree = syntaxTree(view.state);
          const segMeta = getSegmentData(match);
          const citeLoc = segMeta.locator?.trim();
          const rendered = citekeyCache?.citations.find((c) =>
            equal(onlyValType(c?.data || []), onlyValType(match))
          );

          if (isLivePreview) {
            if (rendered) {
              const start = from + match[0].from;
              const end = from + match[match.length - 1].to;
              const center = Math.round((start + end) / 2);

              let linkText: string;

              const centerNode = tree.resolveInner(center, 0);

              if (
                centerNode.type
                  .prop(tokenClassNodeProp)
                  ?.includes('hmd-internal-link')
              ) {
                linkText = view.state.sliceDoc(centerNode.from, centerNode.to);
              }

              const doc = view.state.doc.toString();
              const insideInlineFootnote = citationInsideInlineFootnote(
                doc,
                tree,
                start,
                end
              );

              const selectionOnCitation = view.state.selection.ranges.some(
                (r) =>
                  (start >= r.from && end <= r.to) ||
                  (r.from >= start && r.from <= end) ||
                  (r.to >= start && r.to <= end)
              );

              if (!selectionOnCitation) {
                b.add(
                  start,
                  end,
                  citeDeco(
                    rendered,
                    obsView?.file.path,
                    linkText,
                    insideInlineFootnote
                  )
                );
                continue;
              }
            }
          }

          for (let i = 0, len = match.length; i < len; i++) {
            const part = match[i];
            const next = match[i + 1];
            const start = from + part.from;
            const end = from + part.to;

            const nodeProps = tree
              .resolveInner(start, 1)
              .type.prop(tokenClassNodeProp);

            if (nodeProps && ignoreListRegEx.test(nodeProps)) {
              break;
            }

            switch (part.type) {
              case SegmentType.key: {
                const isUnresolved =
                  !nodeProps?.includes('link') &&
                  citekeyCache?.unresolvedKeys.has(part.val);
                const isResolved = citekeyCache?.resolvedKeys.has(part.val);

                b.add(
                  start,
                  end,
                  citeMark(
                    part.val,
                    obsView?.file.path,
                    isResolved,
                    isUnresolved,
                    rendered?.note ? rendered.noteIndex.toString() : undefined,
                    citeLoc
                  )
                );
                continue;
              }
              case SegmentType.at: {
                const isUnresolved =
                  !!next &&
                  !nodeProps?.includes('link') &&
                  citekeyCache?.unresolvedKeys.has(next.val);
                const isResolved =
                  !!next && citekeyCache?.resolvedKeys.has(next.val);

                const classes: string[] = [part.type];

                if (isUnresolved) classes.push('is-unresolved');
                if (isResolved) classes.push('is-resolved');

                b.add(start, end, citeMarkFormatting(classes.join(' ')));
                continue;
              }
              case SegmentType.curlyBracket:
              case SegmentType.bracket:
                b.add(start, end, citeMarkFormatting(part.type));
                continue;
              case SegmentType.separator:
              case SegmentType.suppressor:
              case SegmentType.prefix:
              case SegmentType.suffix:
                b.add(start, end, citeMarkExtra(part.type));
                continue;
              case SegmentType.locator:
              case SegmentType.locatorLabel:
              case SegmentType.locatorSuffix: {
                const h = segMeta.key
                  ? citationHoverAttrs(
                      segMeta.key,
                      obsView?.file.path,
                      citeLoc
                    )
                  : undefined;
                b.add(start, end, citeMarkExtra(part.type, h));
                continue;
              }
            }
          }
        }
      }

      return b.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

export const setCiteKeyCache = StateEffect.define<FileCache>();
export const citeKeyCacheField = StateField.define<FileCache>({
  create(state) {
    const obsView = state.field(editorInfoField);
    const bibManager = state.field(bibManagerField);

    if (obsView?.file && bibManager?.fileCache.has(obsView.file)) {
      return bibManager.fileCache.get(obsView.file);
    }

    return null;
  },
  update(state, tr) {
    for (const e of tr.effects) {
      if (e.is(setCiteKeyCache)) {
        state = e.value;
      }
    }

    return state;
  },
});

export const bibManagerField = StateField.define<BibManager>({
  create() {
    return null;
  },
  update(state) {
    return state;
  },
});
