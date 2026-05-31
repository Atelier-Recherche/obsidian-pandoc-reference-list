import { Tree } from '@lezer/common';
import { tokenClassNodeProp } from '@codemirror/language';

/** Position of the closing `]` for an inline footnote starting at `caretPos` (`^`). */
export function findInlineFootnoteEnd(doc: string, caretPos: number): number {
  if (doc[caretPos] !== '^' || doc[caretPos + 1] !== '[') return -1;

  let depth = 1;
  for (let i = caretPos + 2; i < doc.length; i++) {
    const ch = doc[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return i;
    } else if (ch === '\n') break;
  }

  return -1;
}

/** True when `pos` lies inside Obsidian inline footnote content (`^[...]`). */
export function isInsideInlineFootnote(doc: string, pos: number): boolean {
  for (let i = pos; i >= 1; i--) {
    if (doc[i - 1] === '^' && doc[i] === '[') {
      const end = findInlineFootnoteEnd(doc, i - 1);
      if (end !== -1 && pos >= i + 1 && pos <= end) return true;
      return false;
    }
    if (doc[i - 1] === '\n') break;
  }
  return false;
}

export function isInFootnoteSyntaxNode(tree: Tree, pos: number): boolean {
  let node = tree.resolveInner(pos, 1);
  while (node) {
    const tokenClass = node.type.prop(tokenClassNodeProp) ?? '';
    if (/footnote/i.test(node.type.name) || /footnote/i.test(tokenClass)) {
      return true;
    }
    node = node.parent;
  }
  return false;
}

/** Inclusive range of an inline footnote (`^[...]`) containing `pos`. */
export function getInlineFootnoteRange(
  doc: string,
  pos: number
): { from: number; to: number } | null {
  for (let i = pos; i >= 1; i--) {
    if (doc[i - 1] === '^' && doc[i] === '[') {
      const caretPos = i - 1;
      const end = findInlineFootnoteEnd(doc, caretPos);
      if (end !== -1 && pos >= i + 1 && pos <= end) {
        return { from: caretPos, to: end + 1 };
      }
      return null;
    }
    if (doc[i - 1] === '\n') break;
  }
  return null;
}

export function rangesOverlap(
  aFrom: number,
  aTo: number,
  bFrom: number,
  bTo: number
): boolean {
  return aFrom < bTo && bFrom < aTo;
}

/** Footnote expanded in Live Preview: cursor lies inside the `^[...]` span. */
export function isInlineFootnoteExpanded(
  footnoteFrom: number,
  footnoteTo: number,
  selectionRanges: readonly { from: number; to: number }[]
): boolean {
  return selectionRanges.some((r) =>
    rangesOverlap(r.from, r.to, footnoteFrom, footnoteTo)
  );
}

export function citationInsideInlineFootnote(
  doc: string,
  tree: Tree,
  from: number,
  to: number
): boolean {
  return (
    isInsideInlineFootnote(doc, from) ||
    isInsideInlineFootnote(doc, to) ||
    isInFootnoteSyntaxNode(tree, from)
  );
}
