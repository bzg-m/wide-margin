import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { EventName, HEARTBEAT_INTERVAL_MS } from '../../shared/api.ts';
import { addPost, addReading, createTestApp, openEventStream } from '../test-app.ts';

describe('reading event stream', () => {
  it('sends new annotations to everyone watching the reading', async () => {
    const { request, student, instructor } = createTestApp();
    // An extra reading first, so this reading's ID differs from its first annotation's
    // and an event published under the wrong ID would be missed.
    await addReading(request, instructor);
    const reading = await addReading(request, instructor);
    const stream = await openEventStream(request, student, reading.id);

    await addPost(request, instructor, { readingId: reading.id, text: 'New annotation' });

    expect(await stream.next()).toMatchObject({
      name: EventName.AnnotationCreated,
      data: { text: 'New annotation', readingId: reading.id },
    });
    await stream.close();
  });

  it('sends new replies to everyone watching the reading', async () => {
    const { request, student, instructor } = createTestApp();
    const reading = await addReading(request, instructor);
    const annotation = await addPost(request, student, { readingId: reading.id });
    const stream = await openEventStream(request, student, reading.id);

    await addPost(request, instructor, {
      readingId: reading.id,
      annotationId: annotation.id,
      text: 'New reply',
    });

    expect(await stream.next()).toMatchObject({
      name: EventName.ReplyCreated,
      data: { text: 'New reply', annotationId: annotation.id },
    });
    await stream.close();
  });

  it('sends a heartbeat event on a quiet stream', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { request, student, instructor } = createTestApp();
    const reading = await addReading(request, instructor);
    const stream = await openEventStream(request, student, reading.id);

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    await addPost(request, instructor, { readingId: reading.id });

    // A heartbeat sent as an SSE comment would be skipped, and the post would arrive first.
    expect((await stream.next()).name).toBe(EventName.Heartbeat);
    await stream.close();
  });

  it("doesn't send posts from other readings", async () => {
    const { request, student, instructor } = createTestApp();
    const reading = await addReading(request, instructor);
    const otherReading = await addReading(request, instructor);
    const stream = await openEventStream(request, student, reading.id);

    await addPost(request, instructor, { readingId: otherReading.id, text: 'Elsewhere' });
    await addPost(request, instructor, { readingId: reading.id, text: 'Here' });

    // If the other reading's post had leaked through, it would arrive first.
    expect((await stream.next()).data.text).toBe('Here');
    await stream.close();
  });

  it("answers 404 for a reading that doesn't exist", async () => {
    const { request, student } = createTestApp();

    const res = await request(student, '/v1/readings/999/events');

    expect(res.status).toBe(404);
  });

  it.each(['annotation', 'reply'])('sends a retried %s only once', async (kind) => {
    const { request, student, instructor } = createTestApp();
    const reading = await addReading(request, instructor);
    const annotation = await addPost(request, student, { readingId: reading.id });
    const path =
      kind === 'annotation'
        ? `/v1/readings/${reading.id}/annotations`
        : `/v1/readings/${reading.id}/annotations/${annotation.id}/replies`;
    const post = (text: string, headers: Record<string, string> = {}) =>
      request(student, path, { method: 'POST', body: { text }, headers });
    const stream = await openEventStream(request, student, reading.id);

    await post('Original', { 'Idempotency-Key': 'key-1' });
    await post('Original', { 'Idempotency-Key': 'key-1' });
    await post('Next');

    // A repeated event for the retry would arrive between these two.
    expect((await stream.next()).data.text).toBe('Original');
    expect((await stream.next()).data.text).toBe('Next');
    await stream.close();
  });
});
