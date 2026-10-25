import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.ts';

describe('error responses', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers unknown routes with a Problem Details 404', async () => {
    const res = await createApp().request('/v1/no-such-route');

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(await res.json()).toMatchObject({ status: 404, title: 'Not found' });
  });

  it('does not reveal unexpected error details to clients', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp();
    app.get('/boom', () => {
      throw new Error('internal detail');
    });

    const res = await app.request('/boom');

    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('internal detail');
  });
});
