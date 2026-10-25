import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { ListUsersResponse } from '../../shared/api.ts';
import type { AppEnv } from '../auth.ts';
import { listUsers } from '../db/users.ts';
import { paginate } from '../pagination.ts';

/** Routes under /v1/users. Open to everyone, since choosing who to sign in as needs the list. */
export function userRoutes(db: DatabaseSync): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/', (c) => {
    const { items, nextPageToken } = paginate(c, (offset, limit) => listUsers(db, offset, limit));
    return c.json({ users: items, nextPageToken } satisfies ListUsersResponse);
  });

  return routes;
}
