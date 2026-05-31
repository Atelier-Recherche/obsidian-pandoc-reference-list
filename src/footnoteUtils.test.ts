import {
  findInlineFootnoteEnd,
  getInlineFootnoteRange,
  isInsideInlineFootnote,
  isInlineFootnoteExpanded,
  rangesOverlap,
} from './footnoteUtils';

describe('footnoteUtils', () => {
  describe('findInlineFootnoteEnd', () => {
    it('finds the closing bracket with nested citation brackets', () => {
      const doc = '^[Ceci est un test [@pasquinelliEyeMasterSocial2023] de référence]';
      expect(findInlineFootnoteEnd(doc, 0)).toBe(doc.length - 1);
    });

    it('returns -1 for invalid syntax', () => {
      expect(findInlineFootnoteEnd('^not a footnote', 0)).toBe(-1);
    });
  });

  describe('isInsideInlineFootnote', () => {
    const doc =
      'Voilà un paragraphe^[Ceci est un test [@pasquinelliEyeMasterSocial2023] de référence]|';

    it('detects positions inside the citation key', () => {
      const keyPos = doc.indexOf('pasquinelli');
      expect(isInsideInlineFootnote(doc, keyPos)).toBe(true);
    });

    it('detects positions in footnote text outside the citation', () => {
      const textPos = doc.indexOf('Ceci est un test');
      expect(isInsideInlineFootnote(doc, textPos)).toBe(true);
    });

    it('returns false outside the inline footnote', () => {
      const textPos = doc.indexOf('Voilà');
      expect(isInsideInlineFootnote(doc, textPos)).toBe(false);
    });
  });

  describe('getInlineFootnoteRange', () => {
    it('returns the full footnote span', () => {
      const doc = 'note ^[teste notes [@Feenberg2016] mieux mais non]';
      const keyPos = doc.indexOf('Feenberg');
      const range = getInlineFootnoteRange(doc, keyPos);
      expect(range).toEqual({ from: 5, to: doc.length });
    });
  });

  describe('isInlineFootnoteExpanded', () => {
    const doc = 'note ^[teste notes [@Feenberg2016] mieux mais non]';
    const range = getInlineFootnoteRange(doc, doc.indexOf('Feenberg'))!;

    it('is true when the cursor is inside the footnote', () => {
      const cursorPos = doc.indexOf('teste');
      expect(
        isInlineFootnoteExpanded(range.from, range.to, [
          { from: cursorPos, to: cursorPos },
        ])
      ).toBe(true);
    });

    it('is false when the cursor is outside the footnote', () => {
      expect(
        isInlineFootnoteExpanded(range.from, range.to, [{ from: 0, to: 0 }])
      ).toBe(false);
    });
  });

  describe('rangesOverlap', () => {
    it('detects overlapping ranges', () => {
      expect(rangesOverlap(0, 5, 3, 8)).toBe(true);
      expect(rangesOverlap(0, 2, 5, 8)).toBe(false);
    });
  });
});
