import { afterEach, describe, expect, it, vi } from 'vitest';

describe('useNow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves forward every 30 seconds', async () => {
    vi.useFakeTimers();
    // A fresh copy of the module, so its timer runs on the fake clock.
    vi.resetModules();
    const { useNow } = await import('./now.ts');
    const now = useNow();
    const start = now.value;

    vi.advanceTimersByTime(30_000);

    expect(now.value).toBe(start + 30_000);
  });
});
