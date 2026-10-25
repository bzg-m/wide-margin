import type { DatabaseSync } from 'node:sqlite';
import type { Annotation, Reply, Role } from '../../shared/api.ts';
import type { CreatePostBody } from '../../shared/schemas.ts';
import { KEY_REUSED } from './idempotency.ts';
import { parseId } from './ids.ts';

const SELECT_THREADS = `
  SELECT a.id, a.reading_id, a.author_id, u.display_name AS author_display_name,
    u.role AS author_role, a.text, a.created_at,
    COUNT(r.id) AS reply_count,
    COALESCE(MAX(r.created_at), a.created_at) AS last_activity_at
  FROM annotations a
  JOIN users u ON u.id = a.author_id
  LEFT JOIN replies r ON r.annotation_id = a.id`;

const SELECT_REPLIES = `
  SELECT r.id, r.annotation_id, a.reading_id, r.author_id,
    u.display_name AS author_display_name, u.role AS author_role, r.text, r.created_at
  FROM replies r
  JOIN annotations a ON a.id = r.annotation_id
  JOIN users u ON u.id = r.author_id`;

type ThreadRow = {
  id: number;
  reading_id: number;
  author_id: number;
  author_display_name: string;
  author_role: Role;
  text: string;
  created_at: string;
  reply_count: number;
  last_activity_at: string;
};

type ReplyRow = Omit<ThreadRow, 'reply_count' | 'last_activity_at'> & { annotation_id: number };

function toAnnotation(row: ThreadRow): Annotation {
  return {
    id: String(row.id),
    readingId: String(row.reading_id),
    authorId: String(row.author_id),
    authorDisplayName: row.author_display_name,
    authorRole: row.author_role,
    text: row.text,
    createdAt: row.created_at,
    replyCount: row.reply_count,
    lastActivityAt: row.last_activity_at,
  };
}

function toReply(row: ReplyRow): Reply {
  return {
    id: String(row.id),
    annotationId: String(row.annotation_id),
    readingId: String(row.reading_id),
    authorId: String(row.author_id),
    authorDisplayName: row.author_display_name,
    authorRole: row.author_role,
    text: row.text,
    createdAt: row.created_at,
  };
}

/** Lists a reading's threads newest first, one page at a time. */
export function listThreads(
  db: DatabaseSync,
  readingId: string,
  offset: number,
  limit: number,
): Annotation[] {
  const rows = db
    .prepare(
      `${SELECT_THREADS} WHERE a.reading_id = ? GROUP BY a.id
       ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`,
    )
    .all(Number(readingId), limit, offset) as ThreadRow[];
  return rows.map(toAnnotation);
}

/** Finds a thread's annotation by API ID, or returns undefined if there is none. */
export function findThread(db: DatabaseSync, id: string): Annotation | undefined {
  const rowId = parseId(id);
  if (rowId === undefined) return undefined;
  const row = db.prepare(`${SELECT_THREADS} WHERE a.id = ? GROUP BY a.id`).get(rowId);
  return row ? toAnnotation(row as ThreadRow) : undefined;
}

/** Lists an annotation's replies oldest first, one page at a time. */
export function listReplies(
  db: DatabaseSync,
  annotationId: string,
  offset: number,
  limit: number,
): Reply[] {
  const rows = db
    .prepare(
      `${SELECT_REPLIES} WHERE r.annotation_id = ? ORDER BY r.created_at, r.id LIMIT ? OFFSET ?`,
    )
    .all(Number(annotationId), limit, offset) as ReplyRow[];
  return rows.map(toReply);
}

function findReply(db: DatabaseSync, id: number): Reply | undefined {
  const row = db.prepare(`${SELECT_REPLIES} WHERE r.id = ?`).get(id);
  return row ? toReply(row as ReplyRow) : undefined;
}

/** Everything needed to create a post: the validated body, plus who wrote it, when, and an optional idempotency key. */
export type NewPost = CreatePostBody & {
  authorId: string;
  createdAt: string;
  idempotencyKey?: string;
};

// NOTE: createReading, createThread and createReply repeat the same idempotency steps (look up
// the key, compare content, then insert) against different tables. They're kept separate because
// each copy is short and readable top to bottom; a shared helper would need table and column
// names passed in as strings. Revisit if a fourth create needs the same steps.

/**
 * Starts a thread, or returns the one started earlier with the same idempotency key.
 * Returns `KEY_REUSED` if that key was used for different text or another reading.
 */
export function createThread(
  db: DatabaseSync,
  readingId: string,
  input: NewPost,
): Annotation | typeof KEY_REUSED {
  const authorId = Number(input.authorId);
  // As in createReading, no other request can run between this lookup and the insert.
  if (input.idempotencyKey !== undefined) {
    const earlier = db
      .prepare(
        'SELECT id, reading_id, text FROM annotations WHERE author_id = ? AND idempotency_key = ?',
      )
      .get(authorId, input.idempotencyKey) as
      { id: number; reading_id: number; text: string } | undefined;
    if (earlier) {
      const same = earlier.reading_id === Number(readingId) && earlier.text === input.text;
      return same ? findThread(db, String(earlier.id))! : KEY_REUSED;
    }
  }
  const { id } = db
    .prepare(
      `INSERT INTO annotations (reading_id, author_id, text, created_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      Number(readingId),
      authorId,
      input.text,
      input.createdAt,
      input.idempotencyKey ?? null,
    ) as { id: number };
  return findThread(db, String(id))!;
}

/**
 * Adds a reply, or returns the one added earlier with the same idempotency key.
 * Returns `KEY_REUSED` if that key was used for different text or another annotation.
 */
export function createReply(
  db: DatabaseSync,
  annotationId: string,
  input: NewPost,
): Reply | typeof KEY_REUSED {
  const authorId = Number(input.authorId);
  // As in createReading, no other request can run between this lookup and the insert.
  if (input.idempotencyKey !== undefined) {
    const earlier = db
      .prepare(
        'SELECT id, annotation_id, text FROM replies WHERE author_id = ? AND idempotency_key = ?',
      )
      .get(authorId, input.idempotencyKey) as
      { id: number; annotation_id: number; text: string } | undefined;
    if (earlier) {
      const same = earlier.annotation_id === Number(annotationId) && earlier.text === input.text;
      return same ? findReply(db, earlier.id)! : KEY_REUSED;
    }
  }
  const { id } = db
    .prepare(
      `INSERT INTO replies (annotation_id, author_id, text, created_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      Number(annotationId),
      authorId,
      input.text,
      input.createdAt,
      input.idempotencyKey ?? null,
    ) as { id: number };
  return findReply(db, id)!;
}
