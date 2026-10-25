import { describe, expect, it } from 'vitest';
import type { Annotation, Reply } from '../../shared/api.ts';
import { addPost, addReading, createTestApp } from '../test-app.ts';

const annotationsPath = (readingId: string) => `/v1/readings/${readingId}/annotations`;
const repliesPath = (readingId: string, annotationId: string) =>
  `/v1/readings/${readingId}/annotations/${annotationId}/replies`;

describe('annotations and replies', () => {
  it('lets a signed-in user post an annotation, shown with its author', async () => {
    const { request, student, instructor } = createTestApp();
    const reading = await addReading(request, instructor);

    const res = await request(student, annotationsPath(reading.id), {
      method: 'POST',
      body: { text: 'Why does this work?' },
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      readingId: reading.id,
      text: 'Why does this work?',
      authorId: student.id,
      authorDisplayName: student.displayName,
      authorRole: student.role,
      replyCount: 0,
    });
  });

  it('lists annotations newest first', async () => {
    const { request, student, instructor } = createTestApp();
    const reading = await addReading(request, instructor);
    for (const text of ['First', 'Second', 'Third']) {
      await addPost(request, student, { readingId: reading.id, text });
    }

    const { annotations } = await (await request(student, annotationsPath(reading.id))).json();

    expect(annotations.map((a: Annotation) => a.text)).toEqual(['Third', 'Second', 'First']);
  });

  it('lists replies oldest first', async () => {
    const { request, student, instructor } = createTestApp();
    const reading = await addReading(request, instructor);
    const annotation = await addPost(request, student, { readingId: reading.id });
    for (const text of ['First', 'Second', 'Third']) {
      await addPost(request, instructor, {
        readingId: reading.id,
        annotationId: annotation.id,
        text,
      });
    }

    const { replies } = await (
      await request(student, repliesPath(reading.id, annotation.id))
    ).json();

    expect(replies.map((r: Reply) => r.text)).toEqual(['First', 'Second', 'Third']);
  });

  it("shows each annotation's reply count and latest activity", async () => {
    const { request, student, instructor } = createTestApp();
    const reading = await addReading(request, instructor);
    const quiet = await addPost(request, student, { readingId: reading.id });
    const busy = await addPost(request, student, { readingId: reading.id });
    await addPost(request, instructor, { readingId: reading.id, annotationId: busy.id });
    const latest = await addPost(request, student, {
      readingId: reading.id,
      annotationId: busy.id,
    });

    const { annotations } = await (await request(student, annotationsPath(reading.id))).json();
    const byId = new Map(annotations.map((a: Annotation) => [a.id, a]));

    expect(byId.get(busy.id)).toMatchObject({ replyCount: 2, lastActivityAt: latest.createdAt });
    expect(byId.get(quiet.id)).toMatchObject({ replyCount: 0, lastActivityAt: quiet.createdAt });
  });

  it('rejects a blank post', async () => {
    const { request, student, instructor } = createTestApp();
    const reading = await addReading(request, instructor);

    const res = await request(student, annotationsPath(reading.id), {
      method: 'POST',
      body: { text: '   ' },
    });

    expect(res.status).toBe(400);
  });

  it("answers 404 for annotations on a reading that doesn't exist", async () => {
    const { request, student } = createTestApp();

    const res = await request(student, annotationsPath('999'));

    expect(res.status).toBe(404);
  });

  it("answers 404 for replies through a reading the annotation doesn't belong to", async () => {
    const { request, student, instructor } = createTestApp();
    const reading = await addReading(request, instructor);
    const otherReading = await addReading(request, instructor);
    const annotation = await addPost(request, student, { readingId: otherReading.id });

    const res = await request(student, repliesPath(reading.id, annotation.id));

    expect(res.status).toBe(404);
  });

  it('rejects signed-out requests', async () => {
    const { request, instructor } = createTestApp();
    const reading = await addReading(request, instructor);

    const res = await request(null, annotationsPath(reading.id));

    expect(res.status).toBe(401);
  });
});

describe.each([
  { kind: 'annotation', pathFor: (readingId: string) => annotationsPath(readingId) },
  {
    kind: 'reply',
    pathFor: (readingId: string, annotationId: string) => repliesPath(readingId, annotationId),
  },
])('posting a $kind', ({ pathFor }) => {
  async function setUp() {
    const app = createTestApp();
    const reading = await addReading(app.request, app.instructor);
    const annotation = await addPost(app.request, app.student, { readingId: reading.id });
    const path = pathFor(reading.id, annotation.id);
    const post = (text: string) =>
      app.request(app.student, path, {
        method: 'POST',
        body: { text },
        headers: { 'Idempotency-Key': 'key-1' },
      });
    return { ...app, path, post };
  }

  it('a retried post with the same Idempotency-Key returns the original', async () => {
    const { request, student, path, post } = await setUp();
    const before = (await (await request(student, path)).json()) as Record<string, unknown[]>;

    const first = await (await post('Hello')).json();
    const retry = await post('Hello');

    expect(retry.status).toBe(201);
    expect(await retry.json()).toEqual(first);
    const after = (await (await request(student, path)).json()) as Record<string, unknown[]>;
    const count = (page: Record<string, unknown[]>) => (page.annotations ?? page.replies).length;
    expect(count(after)).toBe(count(before) + 1);
  });

  it('rejects an Idempotency-Key reused for different text', async () => {
    const { post } = await setUp();
    await post('Hello');

    const res = await post('Something else');

    expect(res.status).toBe(422);
  });
});
