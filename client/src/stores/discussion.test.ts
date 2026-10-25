import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Role, type Annotation, type Reading, type Reply } from '../../../shared/api.ts';
import * as api from '../api/index.ts';
import { connectToReading, type LiveHandlers } from '../live.ts';
import { useDiscussion } from './discussion.ts';
import { useSession } from './session.ts';

vi.mock('../api/index.ts', () => ({
  getReading: vi.fn(),
  listAnnotations: vi.fn(),
  listReplies: vi.fn(),
  listReadingReplies: vi.fn(),
  createAnnotation: vi.fn(),
  createReply: vi.fn(),
}));

vi.mock('../live.ts', () => ({ connectToReading: vi.fn() }));

const reading = (replyCount: number): Reading => ({
  id: '1',
  title: 'Reading',
  description: 'A description.',
  creatorId: '1',
  createdAt: '2026-10-01T00:00:00.000Z',
  annotationCount: 1,
  replyCount,
  lastActivityAt: '2026-10-02T00:00:00.000Z',
});

const annotation = (replyCount: number, text = 'An annotation'): Annotation => ({
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

const newAnnotation = (id: string, authorId: string): Annotation => ({
  ...annotation(0),
  id,
  authorId,
  createdAt: '2026-10-05T00:00:00.000Z',
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

describe('discussion store', () => {
  // What the store passed to the event stream, so tests can play the server's part.
  let live: LiveHandlers;

  beforeEach(async () => {
    setActivePinia(createPinia());
    useSession().user = { id: '3', displayName: 'Sarah', role: Role.Student };
    vi.useFakeTimers();
    vi.mocked(connectToReading).mockImplementation((_id, handlers) => {
      live = handlers;
      return vi.fn();
    });
    vi.mocked(api.getReading).mockResolvedValue(reading(0));
    vi.mocked(api.listAnnotations).mockResolvedValue([annotation(0)]);
    vi.mocked(api.listReplies).mockResolvedValue([]);
    vi.mocked(api.createReply).mockImplementation(async (_r, _a, body) => reply(body.text));
    await useDiscussion().show('1');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe('re-reads', () => {
    it('ignores a re-read that started before a later change', async () => {
      const discussion = useDiscussion();
      const staleAnnotations = deferred<Annotation[]>();
      await discussion.postReply('10', { text: '5' }, 'key-5');
      vi.mocked(api.listAnnotations).mockReturnValueOnce(staleAnnotations.promise);
      await vi.advanceTimersByTimeAsync(300); // The first re-read starts and waits.

      await discussion.postReply('10', { text: '6' }, 'key-6');
      staleAnnotations.resolve([annotation(1)]); // Started before reply 6, so it only knows of one reply.
      await vi.advanceTimersByTimeAsync(0);

      expect(discussion.annotations[0].replyCount).toBe(2);
    });

    it('ignores a re-read that finishes after a later one has been applied', async () => {
      const discussion = useDiscussion();
      const slowAnnotations = deferred<Annotation[]>();
      vi.mocked(api.listAnnotations)
        .mockReturnValueOnce(slowAnnotations.promise)
        .mockResolvedValueOnce([annotation(2, 'Newer')]);

      live.onReady(); // Starts a re-read that waits.
      live.onReady(); // Starts a later re-read, which finishes first.
      await vi.advanceTimersByTimeAsync(0);
      slowAnnotations.resolve([annotation(1, 'Older')]);
      await vi.advanceTimersByTimeAsync(0);

      expect(discussion.annotations[0].text).toBe('Newer');
    });

    it('replaces the counts with a re-read that started after every change', async () => {
      const discussion = useDiscussion();
      await discussion.postReply('10', { text: '5' }, 'key-5');
      vi.mocked(api.listAnnotations).mockResolvedValueOnce([annotation(1, 'From the server')]);
      vi.mocked(api.getReading).mockResolvedValueOnce(reading(1));

      await vi.advanceTimersByTimeAsync(300);

      expect(discussion.annotations[0].text).toBe('From the server');
    });
  });

  describe('live updates', () => {
    it('re-reads, and reloads loaded replies with one request, on every ready', async () => {
      const discussion = useDiscussion();
      await discussion.loadReplies('10');
      vi.clearAllMocks();
      vi.mocked(api.listReadingReplies).mockResolvedValue([reply('5')]);

      live.onReady();
      await vi.advanceTimersByTimeAsync(0);

      expect(api.listAnnotations).toHaveBeenCalledTimes(1);
      expect(api.listReadingReplies).toHaveBeenCalledTimes(1);
      expect(api.listReplies).not.toHaveBeenCalled();
      expect(discussion.replies['10'].map((r) => r.id)).toEqual(['5']);
    });

    it('re-reads when a post arrives before the reading has loaded', async () => {
      const discussion = useDiscussion();
      const firstLoad = deferred<Annotation[]>();
      vi.mocked(api.listAnnotations)
        .mockReturnValueOnce(firstLoad.promise)
        .mockResolvedValueOnce([newAnnotation('11', '2'), annotation(0)]);

      const showing = discussion.show('1');
      live.onAnnotation(newAnnotation('11', '2'));
      firstLoad.resolve([annotation(0)]); // Started before annotation 11 was saved.
      await showing;
      await vi.advanceTimersByTimeAsync(300);

      expect(discussion.annotations.map((t) => t.id)).toContain('11');
    });

    it('applies a post from the stream once, even if its create response already did', async () => {
      const discussion = useDiscussion();
      await discussion.postReply('10', { text: '5' }, 'key-5');

      live.onReply(reply('5'));

      expect(discussion.annotations[0].replyCount).toBe(1);
    });

    it("counts other people's new annotations while the top is out of view, and resets when it's back", () => {
      const discussion = useDiscussion();
      discussion.setTopInView(false);

      live.onAnnotation(newAnnotation('11', '2'));
      live.onAnnotation(newAnnotation('12', '3')); // Sarah's own annotation isn't news to her.
      const whileScrolled = discussion.unseenNewAnnotations;
      discussion.setTopInView(true);

      expect(whileScrolled).toBe(1);
      expect(discussion.unseenNewAnnotations).toBe(0);
    });
  });

  describe('showing all replies', () => {
    beforeEach(async () => {
      vi.mocked(api.listAnnotations).mockResolvedValue([
        { ...annotation(1), id: '10' },
        { ...annotation(0), id: '11' },
      ]);
      vi.mocked(api.listReadingReplies).mockResolvedValue([reply('5')]);
      await useDiscussion().show('1');
    });

    it('opens every annotation that has replies, loaded with one request', async () => {
      const discussion = useDiscussion();

      await discussion.showAllReplies();

      expect(api.listReadingReplies).toHaveBeenCalledTimes(1);
      expect(api.listReplies).not.toHaveBeenCalled();
      expect(discussion.isOpen('10')).toBe(true);
      expect(discussion.isOpen('11')).toBe(false);
      expect(discussion.replies['10'].map((r) => r.id)).toEqual(['5']);
      expect(discussion.allRepliesShown).toBe(true);
    });

    it('closes every annotation when hiding all replies', async () => {
      const discussion = useDiscussion();
      await discussion.showAllReplies();
      discussion.toggle('11');

      discussion.hideAllReplies();

      expect(discussion.isOpen('10')).toBe(false);
      expect(discussion.isOpen('11')).toBe(false);
      expect(discussion.allRepliesShown).toBe(false);
    });
  });
});
