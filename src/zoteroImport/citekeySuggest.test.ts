import {
  familyNameFromAuthor,
  isUsableExplicitCitekey,
  suggestCitekey,
  titleWordInitials,
} from './citekeySuggest';

describe('citekeySuggest', () => {
  const mtime = new Date('2024-06-01').getTime();

  it('uses family name, year, and title initials', () => {
    expect(
      suggestCitekey('Jean Dupont', 'Deep Learning Notes', mtime)
    ).toBe('dupont2024dln');
  });

  it('handles "Last, First" author', () => {
    expect(
      suggestCitekey('Dupont, Jean', 'Introduction a Rust', mtime)
    ).toBe('dupont2024ir');
  });

  it('skips stop words in title initials', () => {
    expect(titleWordInitials('The Art of War')).toBe('aw');
  });

  it('uses first author in a list', () => {
    expect(familyNameFromAuthor('Martin et Dupont')).toBe('Martin');
    expect(suggestCitekey('Martin et Dupont', 'Livre Test', mtime)).toBe(
      'martin2024lt'
    );
  });

  it('keeps explicit citekey from metadata', () => {
    expect(
      suggestCitekey('Dupont', 'Titre', mtime, 'customKey2024')
    ).toBe('customKey2024');
  });

  it('rejects author name mistakenly passed as citekey', () => {
    expect(isUsableExplicitCitekey('Andreas Malm', 'Andreas Malm', 'Book')).toBe(
      false
    );
    expect(
      suggestCitekey('Andreas Malm', 'How to Blow Up a Pipeline', mtime, 'Andreas Malm')
    ).toBe('malm2024htbu');
  });
});
