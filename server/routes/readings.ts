import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ListReadingsResponse, Reading, User } from '../../shared/api.ts';
import { Action, can } from '../../shared/permissions.ts';
import { createReadingBody } from '../../shared/schemas.ts';
import { requirePermission, requireUser, type AppEnv } from '../auth.ts';
import { KEY_REUSED } from '../db/idempotency.ts';
import { createReading, findReading, listReadings } from '../db/readings.ts';
import { paginate } from '../pagination.ts';
import { jsonBody } from '../validation.ts';

/** Removes the fields this user isn't allowed to see. */
function visibleTo(user: User, reading: Reading): Reading {
  if (can(user, Action.ViewParticipation)) return reading;
  const { participatingStudentCount, ...rest } = reading;
  return rest;
}

/** Routes under /v1/readings. */
export function readingRoutes(db: DatabaseSync): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use(requireUser(db));

  routes.get('/', (c) => {
    const { items, nextPageToken } = paginate(c, (offset, limit) =>
      listReadings(db, offset, limit),
    );
    const readings = items.map((reading) => visibleTo(c.get('user'), reading));
    return c.json({ readings, nextPageToken } satisfies ListReadingsResponse);
  });

  routes.get('/:readingId', (c) => {
    const reading = findReading(db, c.req.param('readingId'));
    if (!reading) throw new HTTPException(404, { message: 'Reading not found.' });
    return c.json(visibleTo(c.get('user'), reading));
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
    return c.json(visibleTo(c.get('user'), result), 201);
  });

  return routes;
}
