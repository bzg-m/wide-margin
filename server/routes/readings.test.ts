import { describe, expect, it } from 'vitest';
import type { Reading, User } from '../../shared/api.ts';
import { addPost, addReading, createTestApp, type TestRequest } from '../test-app.ts';

const validBody = { title: 'Chapter 1', description: 'Read the whole chapter.' };

function postReading(
  request: TestRequest,
  user: User,
  { body = validBody as unknown, idempotencyKey }: { body?: unknown; idempotencyKey?: string } = {},
) {
  return request(user, '/v1/readings', {
    method: 'POST',
    body,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
  });
}

async function listReadings(request: TestRequest, user: User, query = '') {
  return (await request(user, `/v1/readings${query}`)).json();
}

describe('readings', () => {
  it('lets instructors create a reading, which then appears in the list', async () => {
    const { request, instructor } = createTestApp();

    const res = await postReading(request, instructor);

    expect(res.status).toBe(201);
    const reading: Reading = await res.json();
    expect(reading).toMatchObject({
      ...validBody,
      creatorId: instructor.id,
      annotationCount: 0,
      replyCount: 0,
      participatingStudentCount: 0,
      lastActivityAt: null,
    });
    expect(res.headers.get('location')).toBe(`/v1/readings/${reading.id}`);
    expect((await listReadings(request, instructor)).readings).toEqual([reading]);
  });

  it("doesn't let students create readings", async () => {
    const { request, student } = createTestApp();

    const res = await postReading(request, student);

    expect(res.status).toBe(403);
  });

  it('rejects an invalid reading with field errors', async () => {
    const { request, instructor } = createTestApp();

    const res = await postReading(request, instructor, { body: { title: ' ' } });

    expect(res.status).toBe(400);
    const fields = (await res.json()).errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(['title', 'description']);
  });

  it("rejects a body that isn't a JSON object", async () => {
    const { request, instructor } = createTestApp();

    const res = await postReading(request, instructor, { body: ['not', 'an', 'object'] });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ detail: 'The request body must be a JSON object.' });
  });

  it('a retried create with the same Idempotency-Key returns the original and adds nothing', async () => {
    const { request, instructor } = createTestApp();

    const first = await (
      await postReading(request, instructor, { idempotencyKey: 'key-1' })
    ).json();
    const retry = await postReading(request, instructor, { idempotencyKey: 'key-1' });

    expect(retry.status).toBe(201);
    expect(await retry.json()).toEqual(first);
    expect((await listReadings(request, instructor)).readings).toHaveLength(1);
  });

  it('rejects an Idempotency-Key reused for different content', async () => {
    const { request, instructor } = createTestApp();
    await postReading(request, instructor, { idempotencyKey: 'key-1' });

    const res = await postReading(request, instructor, {
      idempotencyKey: 'key-1',
      body: { ...validBody, title: 'Chapter 2' },
    });

    expect(res.status).toBe(422);
  });

  it('counts annotations and replies from students and instructors', async () => {
    const { request, student, instructor } = createTestApp();
    const reading = await addReading(request, instructor);
    const studentAnnotation = await addPost(request, student, { readingId: reading.id });
    await addPost(request, instructor, { readingId: reading.id });
    const asReply = { readingId: reading.id, annotationId: studentAnnotation.id };
    await addPost(request, student, asReply);
    await addPost(request, instructor, asReply);

    const found = await (await request(student, `/v1/readings/${reading.id}`)).json();

    expect(found).toMatchObject({ annotationCount: 2, replyCount: 2 });
  });

  it('counts each participating student once, and no instructors', async () => {
    const { request, student, instructor } = createTestApp();
    const reading = await addReading(request, instructor);
    const annotation = await addPost(request, student, { readingId: reading.id });
    const asReply = { readingId: reading.id, annotationId: annotation.id };
    await addPost(request, student, asReply);
    await addPost(request, instructor, asReply);

    const found = await (await request(instructor, `/v1/readings/${reading.id}`)).json();

    expect(found.participatingStudentCount).toBe(1);
  });

  it('hides participation from students', async () => {
    const { request, student, instructor } = createTestApp();
    const reading = await addReading(request, instructor);
    await addPost(request, student, { readingId: reading.id });

    const found = await (await request(student, `/v1/readings/${reading.id}`)).json();

    expect(found).not.toHaveProperty('participatingStudentCount');
  });

  it('pages through readings newest first', async () => {
    const { request, instructor } = createTestApp();
    for (const title of ['First', 'Second', 'Third']) {
      await postReading(request, instructor, { body: { ...validBody, title } });
    }

    const page1 = await listReadings(request, instructor, '?pageSize=2');
    const page2 = await listReadings(
      request,
      instructor,
      `?pageSize=2&pageToken=${page1.nextPageToken}`,
    );

    expect(page1.readings.map((r: Reading) => r.title)).toEqual(['Third', 'Second']);
    expect(page2.readings.map((r: Reading) => r.title)).toEqual(['First']);
    expect(page2.nextPageToken).toBeUndefined();
  });

  it('rejects an invalid page token', async () => {
    const { request, instructor } = createTestApp();

    const res = await request(instructor, '/v1/readings?pageToken=not-a-token');

    expect(res.status).toBe(400);
  });

  it("answers 404 for a reading that doesn't exist", async () => {
    const { request, student } = createTestApp();

    const res = await request(student, '/v1/readings/999');

    expect(res.status).toBe(404);
  });
});
