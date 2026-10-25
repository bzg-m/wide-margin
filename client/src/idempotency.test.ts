import { describe, expect, it } from 'vitest';
import { attemptFor } from './idempotency.ts';

const newKey = () => 'new-key';

describe('attemptFor', () => {
  it("reuses the key when the content hasn't changed", () => {
    const last = { key: 'first-key', body: { title: 'Chapter 4', description: 'Read it.' } };

    const attempt = attemptFor({ title: 'Chapter 4', description: 'Read it.' }, last, newKey);

    expect(attempt.key).toBe('first-key');
  });

  it('uses a new key when the content changed', () => {
    const last = { key: 'first-key', body: { title: 'Chapter 4', description: 'Read it.' } };

    const attempt = attemptFor({ title: 'Chapter 5', description: 'Read it.' }, last, newKey);

    expect(attempt.key).toBe('new-key');
  });
});
