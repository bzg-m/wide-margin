import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Role, type Annotation, type Reading, type Reply } from '../../../shared/api.ts';
import * as api from '../api/index.ts';
import { useDiscussion } from './discussion.ts';

vi.mock('../api/index.ts', () => ({
  getReading: vi.fn(),
  listAnnotations: vi.fn(),
  listReplies: vi.fn(),
  createAnnotation: vi.fn(),
  createReply: vi.fn(),
}));

const reading = (replyCount: number): Reading => ({
  id: '1',
  title: 'Reading',
  description: 'A description.',
  creatorId: '1',
  createdAt: '2026-10-01T00:00:00.000Z',
  threadCount: 1,
  replyCount,
  lastActivityAt: '2026-10-02T00:00:00.000Z',
});

const thread = (replyCount: number, text = 'A thread'): Annotation => ({
  id: '10',
  readingId: '1',
  authorId: '2',
  authorDisplayName: 'Sam',
  authorRole: Role.Student,
  text,
  createdAt: '2026-10-02T00:00:00.000Z',
  replyCount,
  lastActivityAt: '2026-10-02T00:00:00.000Z',
});

const reply = (id: string): Reply => ({
  id,
  annotationId: '10',
  readingId: '1',
  authorId: '2',
  authorDisplayName: 'Sam',
  authorRole: Role.Student,
  text: 'A reply',
  createdAt: '2026-10-03T00:00:00.000Z',
});

/** A promise and the function that resolves it, for controlling when a fake response arrives. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('discussion store re-reads', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.mocked(api.getReading).mockResolvedValue(reading(0));
    vi.mocked(api.listAnnotations).mockResolvedValue([thread(0)]);
    vi.mocked(api.createReply).mockImplementation(async (_r, _a, body) => reply(body.text));
    await useDiscussion().show('1');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('ignores a re-read that started before a later change', async () => {
    const discussion = useDiscussion();
    const staleThreads = deferred<Annotation[]>();
    await discussion.postReply('10', { text: '5' }, 'key-5');
    vi.mocked(api.listAnnotations).mockReturnValueOnce(staleThreads.promise);
    await vi.advanceTimersByTimeAsync(300); // The first re-read starts and waits.

    await discussion.postReply('10', { text: '6' }, 'key-6');
    staleThreads.resolve([thread(1)]); // Started before reply 6, so it only knows of one reply.
    await vi.advanceTimersByTimeAsync(0);

    expect(discussion.threads[0].replyCount).toBe(2);
  });

  it('replaces the counts with a re-read that started after every change', async () => {
    const discussion = useDiscussion();
    await discussion.postReply('10', { text: '5' }, 'key-5');
    vi.mocked(api.listAnnotations).mockResolvedValueOnce([thread(1, 'From the server')]);
    vi.mocked(api.getReading).mockResolvedValueOnce(reading(1));

    await vi.advanceTimersByTimeAsync(300);

    expect(discussion.threads[0].text).toBe('From the server');
  });
});
