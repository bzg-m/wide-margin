import type { DatabaseSync } from 'node:sqlite';
import { Role, type Annotation, type Reading, type Reply, type User } from '../shared/api.ts';
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

/** Posts a thread on a reading, or a reply to `annotationId`, through the API. Returns the created post. */
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
