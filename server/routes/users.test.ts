import { describe, expect, it } from 'vitest';
import { createTestApp } from '../test-app.ts';

describe('users', () => {
  it('lists users without signing in', async () => {
    const { request, student, instructor } = createTestApp();

    const res = await request(null, '/v1/users');

    expect(res.status).toBe(200);
    expect((await res.json()).users).toEqual([student, instructor]);
  });
});
