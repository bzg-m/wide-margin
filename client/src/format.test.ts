import { describe, expect, it } from 'vitest';
import { relativeTime } from './format.ts';

const now = Date.parse('2026-10-24T12:00:00.000Z');
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

describe('relativeTime', () => {
  it('describes recent times relative to now', () => {
    expect(relativeTime(ago(20), now, 'en')).toBe('just now');
    expect(relativeTime(ago(5 * 60), now, 'en')).toBe('5 minutes ago');
    expect(relativeTime(ago(3 * 60 * 60), now, 'en')).toBe('3 hours ago');
    expect(relativeTime(ago(24 * 60 * 60), now, 'en')).toBe('yesterday');
  });

  it('shows a date for times more than a week ago', () => {
    expect(relativeTime('2026-10-11T12:00:00.000Z', now, 'en')).toBe('Oct 11');
  });
});
