import type { DatabaseSync } from 'node:sqlite';
import {
  EventName,
  Role,
  type Annotation,
  type Reading,
  type Reply,
  type User,
} from '../shared/api.ts';
import { createApp } from './app.ts';
import { openDatabase } from './db/database.ts';

/** Options for a test request. A `body` is sent as JSON. */
export type TestRequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

/** Sends a request to a test app as the given user, or as nobody. */
export type TestRequest = (
  user: User | null,
  path: string,
  options?: TestRequestOptions,
) => Promise<Response>;

/** An app on an empty in-memory database with one student and one instructor. */
export function createTestApp() {
  const db = openDatabase(':memory:');
  const student = addUser(db, 'Sam Student', Role.Student);
  const instructor = addUser(db, 'Ines Instructor', Role.Instructor);
  const app = createApp(db);

  const request: TestRequest = async (user, path, { method = 'GET', body, headers } = {}) =>
    app.request(path, {
      method,
      headers: {
        // Browsers mark requests from the app's own pages this way.
        'Sec-Fetch-Site': 'same-origin',
        ...(user ? { Cookie: `user=${user.id}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  return { db, student, instructor, request };
}

/** Adds a user directly to the database, since the API can't create users. */
export function addUser(db: DatabaseSync, displayName: string, role: Role): User {
  const { id } = db
    .prepare('INSERT INTO users (display_name, role) VALUES (?, ?) RETURNING id')
    .get(displayName, role) as { id: number };
  return { id: String(id), displayName, role };
}

/** Creates a reading through the API as the given user, who must be allowed to. */
export async function addReading(
  request: TestRequest,
  user: User,
  body = { title: 'Chapter 1', description: 'Read the whole chapter.' },
): Promise<Reading> {
  const res = await request(user, '/v1/readings', { method: 'POST', body });
  return res.json();
}

/** Posts an annotation on a reading, or a reply to `annotationId`, through the API. Returns the created post. */
export async function addPost(
  request: TestRequest,
  user: User,
  {
    readingId,
    annotationId,
    text = 'A post',
  }: { readingId: string; annotationId?: string; text?: string },
): Promise<Annotation | Reply> {
  const path =
    annotationId === undefined
      ? `/v1/readings/${readingId}/annotations`
      : `/v1/readings/${readingId}/annotations/${annotationId}/replies`;
  const res = await request(user, path, { method: 'POST', body: { text } });
  return res.json();
}

/** One event read from an event stream, with its JSON data parsed. */
export type TestEvent = { name: string; data: Record<string, unknown> };

/**
 * Opens a reading's event stream as the user and waits for `ready`, the way the client will.
 * Read events with `next()`; `close()` disconnects, as a browser closing the page would.
 */
export async function openEventStream(request: TestRequest, user: User, readingId: string) {
  const res = await request(user, `/v1/readings/${readingId}/events`);
  if (res.status !== 200 || !res.body) throw new Error(`Event stream failed: ${res.status}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  // SSE events are blocks of "field: value" lines separated by a blank line.
  // Lines starting with ":" are comments, and are skipped.
  async function next(): Promise<TestEvent> {
    for (;;) {
      const end = buffer.indexOf('\n\n');
      if (end === -1) {
        const { value, done } = await reader.read();
        if (done) throw new Error('Event stream ended');
        buffer += value;
        continue;
      }
      const lines = buffer
        .slice(0, end)
        .split('\n')
        .filter((line) => !line.startsWith(':'));
      buffer = buffer.slice(end + 2);
      if (lines.length === 0) continue;
      const field = (name: string) =>
        lines
          .find((line) => line.startsWith(`${name}:`))
          ?.slice(name.length + 1)
          .trim() ?? '';
      const data = field('data');
      return { name: field('event'), data: data ? JSON.parse(data) : {} };
    }
  }

  const first = await next();
  if (first.name !== EventName.Ready) throw new Error(`Expected ready, got ${first.name}`);
  return { next, close: () => reader.cancel() };
}
