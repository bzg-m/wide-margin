import type { DatabaseSync } from 'node:sqlite';
import type { Role, User } from '../../shared/api.ts';
import { parseId } from './ids.ts';

type UserRow = { id: number; display_name: string; role: Role };

function toUser(row: UserRow): User {
  return { id: String(row.id), displayName: row.display_name, role: row.role };
}

/** Lists users in a stable order, one page at a time. */
export function listUsers(db: DatabaseSync, offset: number, limit: number): User[] {
  const rows = db
    .prepare('SELECT id, display_name, role FROM users ORDER BY id LIMIT ? OFFSET ?')
    .all(limit, offset) as UserRow[];
  return rows.map(toUser);
}

/** Finds a user by API ID, or returns undefined if there is none. */
export function findUser(db: DatabaseSync, id: string): User | undefined {
  const rowId = parseId(id);
  if (rowId === undefined) return undefined;
  const row = db.prepare('SELECT id, display_name, role FROM users WHERE id = ?').get(rowId);
  return row ? toUser(row as UserRow) : undefined;
}
