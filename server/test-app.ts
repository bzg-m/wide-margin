import type { DatabaseSync } from 'node:sqlite';
import { Role, type User } from '../shared/api.ts';
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

/** Adds a thread to a reading, or a reply to `threadId`, directly to the database. Returns its ID. */
export function addPost(
  db: DatabaseSync,
  { readingId, authorId, threadId }: { readingId: string; authorId: string; threadId?: number },
): number {
  const now = new Date().toISOString();
  const row =
    threadId === undefined
      ? db
          .prepare(
            `INSERT INTO annotations (reading_id, author_id, text, created_at)
             VALUES (?, ?, 'Thread', ?) RETURNING id`,
          )
          .get(Number(readingId), Number(authorId), now)
      : db
          .prepare(
            `INSERT INTO replies (annotation_id, author_id, text, created_at)
             VALUES (?, ?, 'Reply', ?) RETURNING id`,
          )
          .get(threadId, Number(authorId), now);
  return (row as { id: number }).id;
}
