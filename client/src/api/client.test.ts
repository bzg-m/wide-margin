import { describe, expect, it } from 'vitest';
import { ApiError, createApiClient } from './client.ts';

type FakeResponse =
  number | 'network-error' | { status: number; body?: unknown; headers?: Record<string, string> };

/**
 * A client whose fetch answers with the given responses in order. Its sleep records each wait
 * instead of waiting, random() always returns 0, and each connection report is recorded.
 */
function fakeClient(responses: FakeResponse[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const waits: number[] = [];
  const reachability: boolean[] = [];
  const client = createApiClient({
    fetch: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      const next = responses[calls.length - 1];
      if (next === undefined) throw new Error('No fake response left');
      if (next === 'network-error') throw new TypeError('Failed to fetch');
      const {
        status,
        body = { ok: true },
        headers,
      } = typeof next === 'number' ? { status: next } : next;
      return new Response(JSON.stringify(body), { status, headers });
    },
    sleep: async (ms) => {
      waits.push(ms);
    },
    random: () => 0,
    onServerReachable: (reachable) => {
      reachability.push(reachable);
    },
  });
  return { client, calls, waits, reachability };
}

describe('request', () => {
  it('retries a GET after a network error and returns the result', async () => {
    const { client, calls } = fakeClient(['network-error', 200]);

    expect(await client.request('/readings')).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  it('waits longer before each retry', async () => {
    const { client, waits } = fakeClient([503, 503, 503, 200]);

    await client.request('/readings');

    expect(waits).toEqual([250, 500, 1000]);
  });

  it('gives up after three retries with an ApiError', async () => {
    const { client, calls } = fakeClient([503, 503, 503, 503]);

    await expect(client.request('/readings')).rejects.toMatchObject({ status: 503 });
    expect(calls).toHaveLength(4);
  });

  it('waits as long as a Retry-After header asks', async () => {
    const { client, waits } = fakeClient([{ status: 429, headers: { 'Retry-After': '2' } }, 200]);

    await client.request('/readings');

    expect(waits).toEqual([2000]);
  });

  it("doesn't retry a 4xx response other than 429", async () => {
    const { client, calls } = fakeClient([404]);

    await expect(client.request('/readings/9')).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(1);
  });

  it("doesn't retry a POST without an idempotency key", async () => {
    const { client, calls } = fakeClient([503]);

    await expect(
      client.request('/readings', { method: 'POST', body: { title: 'T' } }),
    ).rejects.toMatchObject({ status: 503 });
    expect(calls).toHaveLength(1);
  });

  it('sends the same Idempotency-Key on every attempt', async () => {
    const { client, calls } = fakeClient([503, 201]);

    await client.request('/readings', { method: 'POST', body: {}, idempotencyKey: 'key-1' });

    const keys = calls.map(
      ({ init }) => (init.headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(keys).toEqual(['key-1', 'key-1']);
  });

  it('turns a Problem Details response into an ApiError with field errors', async () => {
    const errors = [{ field: 'title', message: "Title can't be empty." }];
    const { client } = fakeClient([
      {
        status: 400,
        body: { title: 'Invalid request', detail: 'Some fields need attention.', errors },
      },
    ]);

    await expect(client.request('/readings', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 400,
      message: 'Some fields need attention.',
      fieldErrors: errors,
    });
  });

  it('describes a gateway error without details as an unreachable server', async () => {
    const { client } = fakeClient([{ status: 502, body: 'Bad Gateway' }]);

    await expect(client.request('/readings', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 502,
      message: "Can't reach the server.",
    });
  });
});

describe('connection reports', () => {
  it('reports the server as unreachable once its retries fail', async () => {
    const { client, reachability } = fakeClient(Array(4).fill('network-error'));

    await expect(client.request('/readings')).rejects.toMatchObject({ serverUnreachable: true });
    expect(reachability).toEqual([false]);
  });

  it('reports the server as reachable when it answers with an error', async () => {
    const { client, reachability } = fakeClient([404]);

    await expect(client.request('/readings/9')).rejects.toBeInstanceOf(ApiError);
    expect(reachability).toEqual([true]);
  });
});

describe('listAll', () => {
  it('follows page tokens until the last page', async () => {
    const { client, calls } = fakeClient([
      { status: 200, body: { users: ['a'], nextPageToken: 'page-2' } },
      { status: 200, body: { users: ['b'] } },
    ]);

    expect(await client.listAll('/users', 'users')).toEqual(['a', 'b']);
    expect(calls[1].url).toBe('/v1/users?pageToken=page-2');
  });
});
