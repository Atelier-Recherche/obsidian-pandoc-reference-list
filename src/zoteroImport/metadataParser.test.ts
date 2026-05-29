import { parsePdfMetadataFromPath } from './metadataParser';
import { suggestCitekey } from './citekeySuggest';

describe('parsePdfMetadataFromPath', () => {
  const pattern = '^(?<author>.+?) - (?<title>.+?)\\.pdf$';

  it('does not set citekey to author when citekey group is absent', () => {
    const meta = parsePdfMetadataFromPath(
      'PDFs/Andreas Malm - How to Blow Up a Pipeline.pdf',
      { source: 'basename', pattern }
    );
    expect(meta.author).toBe('Andreas Malm');
    expect(meta.title).toBe('How to Blow Up a Pipeline');
    expect(meta.citekey).toBe('');
  });

  it('feeds suggestCitekey with distinct keys per title', () => {
    const mtime = new Date('2024-01-01').getTime();
    const a = parsePdfMetadataFromPath(
      'Andreas Malm - How to Blow Up a Pipeline.pdf',
      { source: 'basename', pattern }
    );
    const b = parsePdfMetadataFromPath('Andreas Malm - White Skin Black Fuel.pdf', {
      source: 'basename',
      pattern,
    });
    const ck1 = suggestCitekey(a.author, a.title, mtime, a.citekey);
    const ck2 = suggestCitekey(b.author, b.title, mtime, b.citekey);
    expect(ck1).not.toBe(ck2);
    expect(ck1).toMatch(/^malm2024/);
    expect(ck2).toMatch(/^malm2024/);
  });
});
