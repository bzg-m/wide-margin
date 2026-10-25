import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.ts';
import { openDatabase } from './db/database.ts';
import { createTestApp } from './test-app.ts';

describe('error responses', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers unknown routes with a Problem Details 404', async () => {
    const res = await createApp(openDatabase(':memory:')).request('/v1/no-such-route');

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(await res.json()).toMatchObject({ status: 404, title: 'Not found' });
  });

  it('does not reveal unexpected error details to clients', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp(openDatabase(':memory:'));
    app.get('/boom', () => {
      throw new Error('internal detail');
    });

    const res = await app.request('/boom');

    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('internal detail');
  });
});

describe('cross-site request protection', () => {
  it('rejects a form submission started by another site', async () => {
    const { request, instructor } = createTestApp();

    const res = await request(instructor, '/v1/readings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Sec-Fetch-Site': 'cross-site',
        Origin: 'https://attacker.example',
      },
    });

    expect(res.status).toBe(403);
  });
});
