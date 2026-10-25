import { readFileSync } from 'node:fs';
// Node 26 also exports this class as `Database`, but the TypeScript definitions only know this name.
import { DatabaseSync } from 'node:sqlite';

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

/** Where the database file lives: `DB_PATH` if set, otherwise the project root. */
export const defaultDatabasePath = process.env.DB_PATH ?? 'collab-read.db';

/** Opens a database, enforces foreign keys and creates any missing tables. */
export function openDatabase(path: string): DatabaseSync {
  // SQLite itself leaves foreign keys off. Node's driver turns them on by default; this says so explicitly.
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: true });
  db.exec(schema);
  return db;
}
