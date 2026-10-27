import type { DatabaseSync } from 'node:sqlite';
import { Hono, type Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import {
  EventName,
  type Annotation,
  type ListAnnotationsResponse,
  type ListRepliesResponse,
  type Reply,
  type User,
} from '../../shared/api.ts';
import { createPostBody, type CreatePostBody } from '../../shared/schemas.ts';
import { requireUser, type AppEnv } from '../auth.ts';
import { KEY_REUSED } from '../db/idempotency.ts';
import {
  createAnnotation,
  createReply,
  findAnnotation,
  findReply,
  listAnnotations,
  listReadingReplies,
  listReplies,
  type NewPost,
} from '../db/posts.ts';
import { findReading } from '../db/readings.ts';
import type { ReadingEvents } from '../events.ts';
import { paginate } from '../pagination.ts';
import { jsonBody } from '../validation.ts';

type AnnotationEnv = AppEnv & { Variables: { annotation: Annotation } };
type ReplyEnv = AnnotationEnv & { Variables: { reply: Reply } };

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

  // The annotation named in the path. Answers 404 unless it belongs to this reading.
  // Only used on routes whose path includes :annotationId.
  function annotationInPath(c: Context): Annotation {
    const annotation = findAnnotation(db, c.req.param('annotationId')!);
    if (!annotation || annotation.readingId !== readingIdOf(c)) {
      throw new HTTPException(404, { message: 'Annotation not found.' });
    }
    return annotation;
  }

  /** Loads the annotation named in the path, answering 404 unless it belongs to this reading. */
  const requireAnnotation = createMiddleware<AnnotationEnv>(async (c, next) => {
    c.set('annotation', annotationInPath(c));
    await next();
  });

  /**
   * Loads the reply named in the path and its annotation, answering 404 unless the reply belongs to
   * that annotation and the annotation to this reading. It checks the whole path itself, so a route
   * needs only this middleware and the order of middleware never matters.
   */
  const requireReply = createMiddleware<ReplyEnv>(async (c, next) => {
    const annotation = annotationInPath(c);
    // Only used on routes whose path includes :replyId.
    const reply = findReply(db, c.req.param('replyId')!);
    if (!reply || reply.annotationId !== annotation.id) {
      throw new HTTPException(404, { message: 'Reply not found.' });
    }
    c.set('annotation', annotation);
    c.set('reply', reply);
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

  // Replies from every annotation on the reading; "-" stands for "any annotation". Registered
  // before the next route, which would otherwise take "-" for an annotation ID.
  routes.get('/-/replies', (c) => {
    const readingId = readingIdOf(c);
    const { items, nextPageToken } = paginate(c, (offset, limit) =>
      listReadingReplies(db, readingId, offset, limit),
    );
    return c.json({ replies: items, nextPageToken } satisfies ListRepliesResponse);
  });

  routes.get('/:annotationId', requireAnnotation, (c) => c.json(c.get('annotation')));

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
    c.header(
      'Location',
      `/v1/readings/${reply.readingId}/annotations/${reply.annotationId}/replies/${reply.id}`,
    );
    return c.json(reply, 201);
  });

  routes.get('/:annotationId/replies/:replyId', requireReply, (c) => c.json(c.get('reply')));

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
