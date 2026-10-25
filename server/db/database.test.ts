import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from './database.ts';
import { seed } from './seed.ts';

type Inserted = { id: number };

const now = '2026-10-24T12:00:00.000Z';

describe('database schema', () => {
  let db: DatabaseSync;
  let userId: number;
  let readingId: number;

  const addUser = (name: string) =>
    (
      db
        .prepare("INSERT INTO users (display_name, role) VALUES (?, 'student') RETURNING id")
        .get(name) as Inserted
    ).id;

  const addReading = () =>
    (
      db
        .prepare(
          `INSERT INTO readings (title, description, creator_id, created_at)
           VALUES ('Title', 'Description', ?, ?) RETURNING id`,
        )
        .get(userId, now) as Inserted
    ).id;

  const addAnnotation = (
    text: string,
    { readingId: rid = readingId, authorId = userId, key = null as string | null } = {},
  ) =>
    (
      db
        .prepare(
          `INSERT INTO annotations (reading_id, author_id, text, created_at, idempotency_key)
           VALUES (?, ?, ?, ?, ?) RETURNING id`,
        )
        .get(rid, authorId, text, now, key) as Inserted
    ).id;

  const addReply = (annotationId: number, text: string) =>
    db
      .prepare(
        'INSERT INTO replies (annotation_id, author_id, text, created_at) VALUES (?, ?, ?, ?)',
      )
      .run(annotationId, userId, text, now);

  beforeEach(() => {
    db = openDatabase(':memory:');
    userId = addUser('Ana');
    readingId = addReading();
  });

  afterEach(() => {
    db.close();
  });

  it('enforces foreign keys', () => {
    expect(() => addReply(999, 'Reply to nothing')).toThrow(/FOREIGN KEY/);
  });

  it('limits post text to 2,000 characters, counting each emoji as one', () => {
    expect(() => addAnnotation('😀'.repeat(2000))).not.toThrow();
    expect(() => addAnnotation('😀'.repeat(2001))).toThrow(/CHECK/);
  });

  it('rejects empty post text', () => {
    expect(() => addAnnotation('')).toThrow(/CHECK/);
  });

  it('accepts each idempotency key once per author', () => {
    const otherUserId = addUser('Ben');
    addAnnotation('First', { key: 'key-1' });

    expect(() =>
      addAnnotation('Same key, other author', { authorId: otherUserId, key: 'key-1' }),
    ).not.toThrow();
    expect(() => addAnnotation('Same key, same author', { key: 'key-1' })).toThrow(/UNIQUE/);
  });

  it('attributes each reply to its annotation’s reading in the posts view', () => {
    const otherReadingId = addReading();
    // Reply IDs are deliberately out of step with annotation IDs,
    // so joining replies on the wrong column would change the result.
    const otherAnnotationId = addAnnotation('Other annotation', { readingId: otherReadingId });
    const annotationId = addAnnotation('Annotation');
    addReply(annotationId, 'First reply');
    addReply(annotationId, 'Second reply');
    addReply(otherAnnotationId, 'Reply on the other reading');

    const posts = db
      .prepare('SELECT kind FROM posts WHERE reading_id = ? ORDER BY kind')
      .all(readingId);

    expect(posts).toEqual([{ kind: 'annotation' }, { kind: 'reply' }, { kind: 'reply' }]);
  });
});

describe('openDatabase', () => {
  it('replaces an outdated posts view when an existing database is opened', () => {
    const dir = mkdtempSync(join(tmpdir(), 'collab-read-'));
    const path = join(dir, 'test.db');
    try {
      const old = openDatabase(path);
      seed(old);
      old.exec(`DROP VIEW posts;
        CREATE VIEW posts AS SELECT reading_id, author_id, created_at, 'outdated' AS kind FROM annotations`);
      old.close();

      const db = openDatabase(path);
      const kinds = db.prepare('SELECT DISTINCT kind FROM posts ORDER BY kind').all();
      db.close();

      expect(kinds).toEqual([{ kind: 'annotation' }, { kind: 'reply' }]);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe('seed', () => {
  it('fills a fresh database without breaking any constraint', () => {
    const db = openDatabase(':memory:');

    expect(() => seed(db)).not.toThrow();

    db.close();
  });
});
