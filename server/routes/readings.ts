import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import { EventName, type ListReadingsResponse, type Reading, type User } from '../../shared/api.ts';
import { Action, can } from '../../shared/permissions.ts';
import { createReadingBody } from '../../shared/schemas.ts';
import { requirePermission, requireUser, type AppEnv } from '../auth.ts';
import { KEY_REUSED } from '../db/idempotency.ts';
import { createReading, findReading, listReadings } from '../db/readings.ts';
import type { ReadingEvents } from '../events.ts';
import { paginate } from '../pagination.ts';
import { jsonBody } from '../validation.ts';

// Keeps idle connections from being closed by proxies, which often drop
// connections that have sent nothing for 30 to 60 seconds.
const HEARTBEAT_INTERVAL_MS = 25_000;

/** Removes the fields this user isn't allowed to see. */
function visibleTo(user: User, reading: Reading): Reading {
  if (can(user, Action.ViewParticipation)) return reading;
  const { participatingStudentCount, ...rest } = reading;
  return rest;
}

/** Routes under /v1/readings, including each reading's live event stream. */
export function readingRoutes(db: DatabaseSync, events: ReadingEvents): Hono<AppEnv> {
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

  routes.get('/:readingId/events', (c) => {
    const reading = findReading(db, c.req.param('readingId'));
    if (!reading) throw new HTTPException(404, { message: 'Reading not found.' });

    return streamSSE(c, async (stream) => {
      const unsubscribe = events.subscribe(reading.id, (event) => {
        void stream.writeSSE({ event: event.name, data: JSON.stringify(event.data) });
      });
      stream.onAbort(unsubscribe);

      // Subscribed before this is sent, so a client that has seen `ready` misses nothing posted after.
      await stream.writeSSE({ event: EventName.Ready, data: '' });

      while (!stream.aborted) {
        await stream.sleep(HEARTBEAT_INTERVAL_MS);
        // A line starting with ":" is an SSE comment: it keeps the connection busy,
        // and EventSource ignores it.
        await stream.write(': heartbeat\n\n');
      }
    });
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
    const reading = result.resource;
    c.header('Location', `/v1/readings/${reading.id}`);
    return c.json(visibleTo(c.get('user'), reading), 201);
  });

  return routes;
}
