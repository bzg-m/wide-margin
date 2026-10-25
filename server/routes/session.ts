import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { signInBody } from '../../shared/schemas.ts';
import { requireUser, signIn, signOut, type AppEnv } from '../auth.ts';
import { findUser } from '../db/users.ts';
import { problemResponse } from '../problem.ts';
import { jsonBody } from '../validation.ts';

/** Routes under /v1/session: signing in and out, and who is signed in. */
export function sessionRoutes(db: DatabaseSync): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.post('/', jsonBody(signInBody), (c) => {
    const user = findUser(db, c.req.valid('json').userId);
    if (!user) {
      return problemResponse(c, 400, 'Invalid request', 'Some fields need attention.', [
        { field: 'userId', message: 'No such user.' },
      ]);
    }
    signIn(c, user);
    return c.json(user);
  });

  routes.get('/', requireUser(db), (c) => c.json(c.get('user')));

  routes.delete('/', (c) => {
    signOut(c);
    return c.body(null, 204);
  });

  return routes;
}
