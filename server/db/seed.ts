import type { DatabaseSync } from 'node:sqlite';
import { readings, users } from './seed-data.ts';

type Inserted = { id: number };

/** Fills an empty database with sample users, readings and discussions. */
export function seed(db: DatabaseSync, now = Date.now()): void {
  const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
  const insertUser = db.prepare(
    'INSERT INTO users (display_name, role) VALUES (?, ?) RETURNING id',
  );
  const insertReading = db.prepare(
    `INSERT INTO readings (title, description, creator_id, created_at)
     VALUES (?, ?, ?, ?) RETURNING id`,
  );
  const insertAnnotation = db.prepare(
    `INSERT INTO annotations (reading_id, author_id, text, created_at)
     VALUES (?, ?, ?, ?) RETURNING id`,
  );
  const insertReply = db.prepare(
    'INSERT INTO replies (annotation_id, author_id, text, created_at) VALUES (?, ?, ?, ?)',
  );

  db.exec('BEGIN');
  try {
    const userIds = new Map<string, number>();
    for (const user of users) {
      const { id } = insertUser.get(user.displayName, user.role) as Inserted;
      userIds.set(user.key, id);
    }
    const idOf = (key: string) => userIds.get(key)!;

    for (const reading of readings) {
      const { id: readingId } = insertReading.get(
        reading.title,
        reading.description,
        idOf(reading.creator),
        minutesAgo(reading.minutesAgo),
      ) as Inserted;

      for (const annotation of reading.annotations) {
        const { id: annotationId } = insertAnnotation.get(
          readingId,
          idOf(annotation.author),
          annotation.text,
          minutesAgo(annotation.minutesAgo),
        ) as Inserted;

        for (const reply of annotation.replies) {
          insertReply.run(
            annotationId,
            idOf(reply.author),
            reply.text,
            minutesAgo(reply.minutesAgo),
          );
        }
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
