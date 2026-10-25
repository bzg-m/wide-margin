import { describe, expect, it } from 'vitest';
import type { Reading } from '../../shared/api.ts';
import { defaultSort, nextSort, sortReadings, SortKey } from './readings.ts';

function reading(fields: Partial<Reading> & { id: string }): Reading {
  return {
    title: `Reading ${fields.id}`,
    description: 'A description.',
    creatorId: '1',
    createdAt: '2026-10-01T00:00:00.000Z',
    threadCount: 0,
    replyCount: 0,
    lastActivityAt: null,
    ...fields,
  };
}

const ids = (readings: Reading[]) => readings.map((r) => r.id);

describe('sortReadings', () => {
  it('sorts newest first by default', () => {
    const older = reading({ id: 'older', createdAt: '2026-10-01T00:00:00.000Z' });
    const newer = reading({ id: 'newer', createdAt: '2026-10-05T00:00:00.000Z' });

    expect(ids(sortReadings([older, newer], defaultSort))).toEqual(['newer', 'older']);
  });

  it('sorts titles alphabetically, ignoring case', () => {
    const readings = [
      reading({ id: 'b', title: 'beta' }),
      reading({ id: 'a', title: 'Alpha' }),
      reading({ id: 'c', title: 'Gamma' }),
    ];

    const sorted = sortReadings(readings, { key: SortKey.Title, descending: false });

    expect(ids(sorted)).toEqual(['a', 'b', 'c']);
  });

  it('puts readings with no activity last, in either direction', () => {
    const quiet = reading({ id: 'quiet', lastActivityAt: null });
    const early = reading({ id: 'early', lastActivityAt: '2026-10-02T00:00:00.000Z' });
    const late = reading({ id: 'late', lastActivityAt: '2026-10-09T00:00:00.000Z' });

    const newest = sortReadings([quiet, early, late], {
      key: SortKey.LastActivity,
      descending: true,
    });
    const oldest = sortReadings([quiet, early, late], {
      key: SortKey.LastActivity,
      descending: false,
    });

    expect(ids(newest)).toEqual(['late', 'early', 'quiet']);
    expect(ids(oldest)).toEqual(['early', 'late', 'quiet']);
  });

  it('sorts by total annotations, threads plus replies', () => {
    const manyThreads = reading({ id: 'threads', threadCount: 4, replyCount: 0 });
    const manyReplies = reading({ id: 'replies', threadCount: 1, replyCount: 6 });

    const sorted = sortReadings([manyThreads, manyReplies], {
      key: SortKey.Annotations,
      descending: true,
    });

    expect(ids(sorted)).toEqual(['replies', 'threads']);
  });
});

describe('nextSort', () => {
  it('starts titles A to Z and other columns largest first, and reverses on a second choice', () => {
    const byTitle = nextSort(defaultSort, SortKey.Title);
    const byAnnotations = nextSort(byTitle, SortKey.Annotations);

    expect(byTitle).toEqual({ key: SortKey.Title, descending: false });
    expect(byAnnotations).toEqual({ key: SortKey.Annotations, descending: true });
    expect(nextSort(byAnnotations, SortKey.Annotations)).toEqual({
      key: SortKey.Annotations,
      descending: false,
    });
  });
});
