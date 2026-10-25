import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { problemResponse } from './problem.ts';
import { readingRoutes } from './routes/readings.ts';
import { sessionRoutes } from './routes/session.ts';
import { userRoutes } from './routes/users.ts';

/** Builds the API app without starting a server, so tests can call it directly. */
export function createApp(db: DatabaseSync): Hono {
  const app = new Hono();

  // Rejects form submissions started by other sites. See "Security" in docs/decisions.md.
  app.use(csrf());
  app.route('/v1/session', sessionRoutes(db));
  app.route('/v1/users', userRoutes(db));
  app.route('/v1/readings', readingRoutes(db));

  app.notFound((c) =>
    problemResponse(c, 404, 'Not found', `No route for ${c.req.method} ${c.req.path}.`),
  );

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return problemResponse(c, err.status, err.message || 'Request failed');
    }
    console.error(err);
    return problemResponse(c, 500, 'Something went wrong', 'The server hit an unexpected error.');
  });

  return app;
}
