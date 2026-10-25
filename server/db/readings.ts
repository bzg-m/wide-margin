import type { DatabaseSync } from 'node:sqlite';
import type { Reading } from '../../shared/api.ts';
import type { CreateReadingBody } from '../../shared/schemas.ts';
import { KEY_REUSED } from './idempotency.ts';
import { parseId } from './ids.ts';

// The counting rules: every count on a reading comes from this query over the posts view.
const SELECT_READINGS = `
  SELECT r.id, r.title, r.description, r.creator_id, r.created_at,
    COUNT(p.kind) FILTER (WHERE p.kind = 'thread') AS thread_count,
    COUNT(p.kind) FILTER (WHERE p.kind = 'reply') AS reply_count,
    COUNT(DISTINCT p.author_id) FILTER (WHERE u.role = 'student') AS participating_student_count,
    MAX(p.created_at) AS last_activity_at
  FROM readings r
  LEFT JOIN posts p ON p.reading_id = r.id
  LEFT JOIN users u ON u.id = p.author_id`;

type ReadingRow = {
  id: number;
  title: string;
  description: string;
  creator_id: number;
  created_at: string;
  thread_count: number;
  reply_count: number;
  participating_student_count: number;
  last_activity_at: string | null;
};

function toReading(row: ReadingRow): Reading {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    creatorId: String(row.creator_id),
    createdAt: row.created_at,
    threadCount: row.thread_count,
    replyCount: row.reply_count,
    participatingStudentCount: row.participating_student_count,
    lastActivityAt: row.last_activity_at,
  };
}

/** Lists readings newest first, one page at a time. */
export function listReadings(db: DatabaseSync, offset: number, limit: number): Reading[] {
  const rows = db
    .prepare(
      `${SELECT_READINGS} GROUP BY r.id ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as ReadingRow[];
  return rows.map(toReading);
}

/** Finds a reading by API ID, or returns undefined if there is none. */
export function findReading(db: DatabaseSync, id: string): Reading | undefined {
  const rowId = parseId(id);
  if (rowId === undefined) return undefined;
  const row = db.prepare(`${SELECT_READINGS} WHERE r.id = ? GROUP BY r.id`).get(rowId);
  return row ? toReading(row as ReadingRow) : undefined;
}

/** Everything needed to create a reading: the validated body, plus who created it, when, and an optional idempotency key. */
export type NewReading = CreateReadingBody & {
  creatorId: string;
  createdAt: string;
  idempotencyKey?: string;
};

/**
 * Creates a reading, or returns the one created earlier with the same idempotency key.
 * Returns `KEY_REUSED` if that key was used for different content.
 */
export function createReading(db: DatabaseSync, input: NewReading): Reading | typeof KEY_REUSED {
  const creatorId = Number(input.creatorId);
  // Node runs one request's code at a time, switching only at an `await`. These database
  // calls are synchronous, so no other request can run between this lookup and the insert.
  // (The UNIQUE constraint still blocks a duplicate if that ever changes.)
  if (input.idempotencyKey !== undefined) {
    const earlier = db
      .prepare(
        'SELECT id, title, description FROM readings WHERE creator_id = ? AND idempotency_key = ?',
      )
      .get(creatorId, input.idempotencyKey) as
      { id: number; title: string; description: string } | undefined;
    if (earlier) {
      const same = earlier.title === input.title && earlier.description === input.description;
      return same ? findReading(db, String(earlier.id))! : KEY_REUSED;
    }
  }
  const { id } = db
    .prepare(
      `INSERT INTO readings (title, description, creator_id, created_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      input.title,
      input.description,
      creatorId,
      input.createdAt,
      input.idempotencyKey ?? null,
    ) as { id: number };
  return findReading(db, String(id))!;
}
