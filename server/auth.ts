import type { DatabaseSync } from 'node:sqlite';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { User } from '../shared/api.ts';
import { can, type Action } from '../shared/permissions.ts';
import { findUser } from './db/users.ts';

const COOKIE_NAME = 'user';
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;

/** Values that middleware makes available to route handlers. */
export type AppEnv = { Variables: { user: User } };

/**
 * Signs the user in by setting a cookie. Sign-in is simulated: the cookie holds the user ID, unsigned.
 * HttpOnly keeps it from page scripts; SameSite=Lax keeps browsers from sending it with
 * requests that other sites start.
 */
export function signIn(c: Context, user: User): void {
  setCookie(c, COOKIE_NAME, user.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: THIRTY_DAYS_IN_SECONDS,
  });
}

/** Signs the current user out by clearing the cookie. */
export function signOut(c: Context): void {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}

/** Middleware that loads the signed-in user, or answers 401 if there is none. */
export function requireUser(db: DatabaseSync) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const userId = getCookie(c, COOKIE_NAME);
    const user = userId ? findUser(db, userId) : undefined;
    if (!user) throw new HTTPException(401, { message: 'Sign in to continue.' });
    c.set('user', user);
    await next();
  });
}

/** Middleware that answers 403 unless the signed-in user may perform the action. */
export function requirePermission(action: Action) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (!can(c.get('user'), action)) {
      throw new HTTPException(403, { message: "You don't have permission to do that." });
    }
    await next();
  });
}
