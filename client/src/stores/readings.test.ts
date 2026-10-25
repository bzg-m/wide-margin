import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Reading } from '../../../shared/api.ts';
import { useReadings } from './readings.ts';

const reading = (id: string): Reading => ({
  id,
  title: `Reading ${id}`,
  description: 'A description.',
  creatorId: '1',
  createdAt: '2026-10-01T00:00:00.000Z',
  threadCount: 0,
  replyCount: 0,
  lastActivityAt: null,
});

describe('readings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('adds a created reading at the top, once', () => {
    const readings = useReadings();
    readings.items = [reading('1')];

    readings.add(reading('2'));
    readings.add(reading('2'));

    expect(readings.items.map((r) => r.id)).toEqual(['2', '1']);
  });
});
