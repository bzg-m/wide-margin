import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { problemResponse } from './problem.ts';

export function createApp(): Hono {
  const app = new Hono();

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
