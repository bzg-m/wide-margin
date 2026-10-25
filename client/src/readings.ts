import type { Reading } from '../../shared/api.ts';

/** The columns the readings list can be sorted by. */
export const SortKey = {
  Title: 'title',
  Annotations: 'annotations',
  Students: 'students',
  Created: 'created',
  LastActivity: 'lastActivity',
} as const;
/** One of the values of `SortKey`. */
export type SortKey = (typeof SortKey)[keyof typeof SortKey];

/** How the readings list is sorted. */
export type Sort = { key: SortKey; descending: boolean };

/** Newest first by creation date, unless the user picks otherwise. */
export const defaultSort: Sort = { key: SortKey.Created, descending: true };

/** Total annotations on a reading: threads plus replies. */
export function annotationCount(reading: Reading): number {
  return reading.threadCount + reading.replyCount;
}

const valueOf: Record<SortKey, (reading: Reading) => string | number | null> = {
  [SortKey.Title]: (r) => r.title,
  [SortKey.Annotations]: annotationCount,
  [SortKey.Students]: (r) => r.participatingStudentCount ?? 0,
  [SortKey.Created]: (r) => r.createdAt,
  [SortKey.LastActivity]: (r) => r.lastActivityAt,
};

/** Returns the readings sorted as asked, leaving the input untouched. Readings with no activity always sort last. */
export function sortReadings(readings: Reading[], sort: Sort): Reading[] {
  const value = valueOf[sort.key];
  return [...readings].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    const order =
      typeof x === 'string' && typeof y === 'string'
        ? x.localeCompare(y, undefined, { sensitivity: 'base' })
        : Number(x) - Number(y);
    return sort.descending ? -order : order;
  });
}

/**
 * The sort after choosing a column. Choosing the current column reverses it; a new column starts
 * A to Z for titles, and largest or newest first otherwise.
 */
export function nextSort(current: Sort, key: SortKey): Sort {
  if (current.key === key) return { key, descending: !current.descending };
  return { key, descending: key !== SortKey.Title };
}
