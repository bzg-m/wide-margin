import type { DatabaseSync } from 'node:sqlite';
import { Hono, type Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import {
  EventName,
  type Annotation,
  type ListAnnotationsResponse,
  type ListRepliesResponse,
  type User,
} from '../../shared/api.ts';
import { createPostBody, type CreatePostBody } from '../../shared/schemas.ts';
import { requireUser, type AppEnv } from '../auth.ts';
import { KEY_REUSED } from '../db/idempotency.ts';
import {
  createReply,
  createAnnotation,
  findAnnotation,
  listReplies,
  listAnnotations,
  type NewPost,
} from '../db/posts.ts';
import { findReading } from '../db/readings.ts';
import type { ReadingEvents } from '../events.ts';
import { paginate } from '../pagination.ts';
import { jsonBody } from '../validation.ts';

type AnnotationEnv = AppEnv & { Variables: { annotation: Annotation } };

// These routes are mounted under /v1/readings/:readingId/annotations, so every request has a
// readingId. TypeScript can't see the mount path from here, so the `!` tells it the value exists.
const readingIdOf = (c: Context) => c.req.param('readingId')!;

/** Routes under /v1/readings/:readingId/annotations: annotations and their replies. New posts are published to `events`. */
export function annotationRoutes(db: DatabaseSync, events: ReadingEvents): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use(requireUser(db));

  // Every route here belongs to a reading, so check that it exists first.
  routes.use(async (c, next) => {
    if (!findReading(db, readingIdOf(c))) {
      throw new HTTPException(404, { message: 'Reading not found.' });
    }
    await next();
  });

  /** Loads the annotation named in the path, answering 404 unless it belongs to this reading. */
  const requireAnnotation = createMiddleware<AnnotationEnv>(async (c, next) => {
    // Only used on routes whose path includes :annotationId.
    const annotation = findAnnotation(db, c.req.param('annotationId')!);
    if (!annotation || annotation.readingId !== readingIdOf(c)) {
      throw new HTTPException(404, { message: 'Annotation not found.' });
    }
    c.set('annotation', annotation);
    await next();
  });

  routes.get('/', (c) => {
    const readingId = readingIdOf(c);
    const { items, nextPageToken } = paginate(c, (offset, limit) =>
      listAnnotations(db, readingId, offset, limit),
    );
    return c.json({ annotations: items, nextPageToken } satisfies ListAnnotationsResponse);
  });

  routes.post('/', jsonBody(createPostBody), (c) => {
    const body = c.req.valid('json');
    const post = newPost(body, c.get('user'), c.req.header('Idempotency-Key'));
    const result = createAnnotation(db, readingIdOf(c), post);
    if (result === KEY_REUSED) throw keyReused();
    const { resource: annotation, isNew } = result;
    if (isNew) {
      events.publish(annotation.readingId, { name: EventName.AnnotationCreated, data: annotation });
    }
    c.header('Location', `/v1/readings/${annotation.readingId}/annotations/${annotation.id}`);
    return c.json(annotation, 201);
  });

  routes.get('/:annotationId/replies', requireAnnotation, (c) => {
    const { id } = c.get('annotation');
    const { items, nextPageToken } = paginate(c, (offset, limit) =>
      listReplies(db, id, offset, limit),
    );
    return c.json({ replies: items, nextPageToken } satisfies ListRepliesResponse);
  });

  routes.post('/:annotationId/replies', requireAnnotation, jsonBody(createPostBody), (c) => {
    const body = c.req.valid('json');
    const post = newPost(body, c.get('user'), c.req.header('Idempotency-Key'));
    const result = createReply(db, c.get('annotation').id, post);
    if (result === KEY_REUSED) throw keyReused();
    const { resource: reply, isNew } = result;
    if (isNew) events.publish(reply.readingId, { name: EventName.ReplyCreated, data: reply });
    return c.json(reply, 201);
  });

  return routes;
}

function newPost(body: CreatePostBody, author: User, idempotencyKey?: string): NewPost {
  return { ...body, authorId: author.id, createdAt: new Date().toISOString(), idempotencyKey };
}

function keyReused(): HTTPException {
  return new HTTPException(422, {
    message: 'This Idempotency-Key was already used for a different post.',
  });
}
