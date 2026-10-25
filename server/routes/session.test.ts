import { describe, expect, it } from 'vitest';
import { createTestApp } from '../test-app.ts';

describe('session', () => {
  it('signing in sets an HttpOnly, SameSite=Lax cookie and returns the user', async () => {
    const { request, student } = createTestApp();

    const res = await request(null, '/v1/session', {
      method: 'POST',
      body: { userId: student.id },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(student);
    const cookie = res.headers.get('set-cookie');
    expect(cookie).toMatch(new RegExp(`^user=${student.id};`, 'u'));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('rejects requests whose cookie names no known user', async () => {
    const { request } = createTestApp();

    const res = await request(null, '/v1/session', { headers: { Cookie: 'user=999' } });

    expect(res.status).toBe(401);
  });

  it('signing out tells the browser to delete the cookie', async () => {
    const { request, student } = createTestApp();

    const res = await request(student, '/v1/session', { method: 'DELETE' });

    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toMatch(/^user=;.*Max-Age=0/u);
  });
});
