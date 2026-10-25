import { describe, expect, it } from 'vitest';
import { Role, type Annotation, type Reading, type Reply } from '../../shared/api.ts';
import {
  AnnotationOrder,
  applyAnnotation,
  applyReply,
  mergeReplies,
  sortAnnotations,
  type DiscussionState,
} from './discussion.ts';

const reading: Reading = {
  id: '1',
  title: 'Reading',
  description: 'A description.',
  creatorId: '1',
  createdAt: '2026-10-01T00:00:00.000Z',
  annotationCount: 1,
  replyCount: 0,
  lastActivityAt: '2026-10-02T00:00:00.000Z',
};

const annotation = (id: string, fields: Partial<Annotation> = {}): Annotation => ({
  id,
  readingId: '1',
  authorId: '2',
  authorDisplayName: 'Sam',
  authorRole: Role.Student,
  text: 'An annotation',
  createdAt: '2026-10-02T00:00:00.000Z',
  replyCount: 0,
  lastActivityAt: '2026-10-02T00:00:00.000Z',
  ...fields,
});

const reply = (id: string, createdAt = '2026-10-03T00:00:00.000Z'): Reply => ({
  id,
  annotationId: '10',
  readingId: '1',
  authorId: '2',
  authorDisplayName: 'Sam',
  authorRole: Role.Student,
  text: 'A reply',
  createdAt,
});

const state = (fields: Partial<DiscussionState> = {}): DiscussionState => ({
  reading,
  annotations: [annotation('10')],
  replies: {},
  counted: new Set(),
  ...fields,
});

describe('applyAnnotation and applyReply', () => {
  it('counts a post once, even when it arrives twice', () => {
    const once = applyReply(state(), reply('5'));
    const twice = applyReply(once, reply('5'));

    expect(twice.annotations[0].replyCount).toBe(1);
    expect(twice.reading.replyCount).toBe(1);
  });

  it("doesn't count a post that a fetch already shows", () => {
    const withAnnotation = applyAnnotation(state(), annotation('10'));

    expect(withAnnotation.annotations).toHaveLength(1);
    expect(withAnnotation.reading.annotationCount).toBe(1);
  });

  it("moves the annotation's and reading's last activity to the new post", () => {
    const after = applyReply(state(), reply('5', '2026-10-04T00:00:00.000Z'));

    expect(after.annotations[0].lastActivityAt).toBe('2026-10-04T00:00:00.000Z');
    expect(after.reading.lastActivityAt).toBe('2026-10-04T00:00:00.000Z');
  });

  it('adds a reply to its annotation only if the replies are loaded', () => {
    const closed = applyReply(state(), reply('5'));
    const open = applyReply(state({ replies: { '10': [] } }), reply('5'));

    expect(closed.replies['10']).toBeUndefined();
    expect(open.replies['10'].map((r) => r.id)).toEqual(['5']);
  });
});

describe('mergeReplies', () => {
  it('keeps one copy of each reply, oldest first', () => {
    const earlier = reply('1', '2026-10-03T00:00:00.000Z');
    const later = reply('2', '2026-10-04T00:00:00.000Z');

    expect(mergeReplies([later], [earlier, later]).map((r) => r.id)).toEqual(['1', '2']);
  });
});

describe('sortAnnotations', () => {
  it('orders annotations by when they were posted, or by latest activity', () => {
    const older = annotation('1', {
      createdAt: '2026-10-01T00:00:00.000Z',
      lastActivityAt: '2026-10-09T00:00:00.000Z',
    });
    const newer = annotation('2', {
      createdAt: '2026-10-05T00:00:00.000Z',
      lastActivityAt: '2026-10-05T00:00:00.000Z',
    });

    expect(sortAnnotations([older, newer], AnnotationOrder.Newest).map((t) => t.id)).toEqual([
      '2',
      '1',
    ]);
    expect(
      sortAnnotations([older, newer], AnnotationOrder.RecentActivity).map((t) => t.id),
    ).toEqual(['1', '2']);
  });
});
