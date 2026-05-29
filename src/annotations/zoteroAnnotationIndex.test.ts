import { buildAnnotationRowsFromSnapshot } from './zoteroAnnotationIndex';
import type { ZoteroStoreSnapshot } from '../zoteroApi/types';

describe('buildAnnotationRowsFromSnapshot', () => {
  it('indexes annotation items with parent titles', () => {
    const snap: ZoteroStoreSnapshot = {
      libraryVersion: 1,
      items: {
        att1: {
          key: 'att1',
          version: 1,
          synced: true,
          data: {
            itemType: 'attachment',
            title: 'paper.pdf',
            parentItem: 'top1',
          },
        },
        top1: {
          key: 'top1',
          version: 1,
          synced: true,
          data: { itemType: 'journalArticle', title: 'My Article' },
        },
        ann1: {
          key: 'ann1',
          version: 1,
          synced: true,
          data: {
            itemType: 'annotation',
            parentItem: 'att1',
            annotationText: 'Important quote',
            annotationComment: 'Note',
            annotationPageLabel: '3',
          },
        },
      },
      pendingDeleteKeys: [],
      retryFetchKeys: [],
    };
    const rows = buildAnnotationRowsFromSnapshot(snap);
    expect(rows).toHaveLength(1);
    expect(rows[0].annotationText).toBe('Important quote');
    expect(rows[0].topItemTitle).toBe('My Article');
    expect(rows[0].parentAttachmentKey).toBe('att1');
  });
});
