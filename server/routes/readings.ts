import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ListReadingsResponse } from '../../shared/api.ts';
import { Action } from '../../shared/permissions.ts';
import { createReadingBody } from '../../shared/schemas.ts';
import { requirePermission, requireUser, type AppEnv } from '../auth.ts';
import { KEY_REUSED } from '../db/idempotency.ts';
import { createReading, findReading, listReadings } from '../db/readings.ts';
import { paginate } from '../pagination.ts';
import { jsonBody } from '../validation.ts';

/** Routes under /v1/readings. */
export function readingRoutes(db: DatabaseSync): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use(requireUser(db));

  routes.get('/', (c) => {
    const { items, nextPageToken } = paginate(c, (offset, limit) =>
      listReadings(db, offset, limit),
    );
    return c.json({ readings: items, nextPageToken } satisfies ListReadingsResponse);
  });

  routes.get('/:readingId', (c) => {
    const reading = findReading(db, c.req.param('readingId'));
    if (!reading) throw new HTTPException(404, { message: 'Reading not found.' });
    return c.json(reading);
  });

  routes.post('/', requirePermission(Action.CreateReading), jsonBody(createReadingBody), (c) => {
    const result = createReading(db, {
      ...c.req.valid('json'),
      creatorId: c.get('user').id,
      createdAt: new Date().toISOString(),
      idempotencyKey: c.req.header('Idempotency-Key'),
    });
    if (result === KEY_REUSED) {
      throw new HTTPException(422, {
        message: 'This Idempotency-Key was already used for a different reading.',
      });
    }
    c.header('Location', `/v1/readings/${result.id}`);
    return c.json(result, 201);
  });

  return routes;
}
