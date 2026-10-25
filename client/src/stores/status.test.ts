import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { Priority, useStatus } from './status.ts';

describe('status', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('shows only the most important problem', () => {
    const status = useStatus();

    status.report({ id: 'server', message: 'Server down', priority: Priority.Server });
    status.report({ id: 'live', message: 'Reconnecting', priority: Priority.LiveUpdates });

    expect(status.current?.id).toBe('server');
  });

  it('shows being signed out above a lost connection', () => {
    const status = useStatus();

    status.report({ id: 'signed-out', message: 'Signed out', priority: Priority.SignedOut });
    status.report({ id: 'server', message: 'Server down', priority: Priority.Server });

    expect(status.current?.id).toBe('signed-out');
  });

  it('shows the next problem once the current one is resolved', () => {
    const status = useStatus();
    status.report({ id: 'live', message: 'Reconnecting', priority: Priority.LiveUpdates });
    status.report({ id: 'server', message: 'Server down', priority: Priority.Server });

    status.resolve('server');

    expect(status.current?.id).toBe('live');
  });
});
