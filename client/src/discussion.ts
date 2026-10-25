import type { Annotation, Reading, Reply } from '../../shared/api.ts';

/** What a reading's discussion shows, as far as new posts are concerned. */
export type DiscussionState = {
  reading: Reading;
  annotations: Annotation[];
  /** Loaded replies by annotation ID. An annotation has an entry once its replies have been loaded. */
  replies: Record<string, Reply[]>;
  /**
   * Posts already counted since the page opened, as "annotation:ID" or "reply:ID", so a post that
   * arrives twice (in its create response and again as an event) is counted once.
   */
  counted: Set<string>;
};

// ISO 8601 times in UTC sort correctly as text.
const later = (a: string | null, b: string) => (a !== null && a > b ? a : b);

/** Adds a new annotation, counting it on the reading unless it's already shown or counted. */
export function applyAnnotation(state: DiscussionState, annotation: Annotation): DiscussionState {
  const key = `annotation:${annotation.id}`;
  if (state.counted.has(key)) return state;
  const counted = new Set(state.counted).add(key);
  // Already in the list from a fetch, which counted it on the server.
  if (state.annotations.some((t) => t.id === annotation.id)) return { ...state, counted };
  return {
    ...state,
    counted,
    annotations: [annotation, ...state.annotations],
    reading: {
      ...state.reading,
      annotationCount: state.reading.annotationCount + 1,
      lastActivityAt: later(state.reading.lastActivityAt, annotation.createdAt),
    },
  };
}

/** Adds a new reply, counting it on its annotation and reading unless it's already shown or counted. */
export function applyReply(state: DiscussionState, reply: Reply): DiscussionState {
  const key = `reply:${reply.id}`;
  if (state.counted.has(key)) return state;
  const counted = new Set(state.counted).add(key);
  const loaded = state.replies[reply.annotationId];
  // Already in the annotation's replies from a fetch, which counted it on the server.
  if (loaded?.some((r) => r.id === reply.id)) return { ...state, counted };
  return {
    ...state,
    counted,
    replies: loaded
      ? { ...state.replies, [reply.annotationId]: mergeReplies(loaded, [reply]) }
      : state.replies,
    annotations: state.annotations.map((annotation) =>
      annotation.id === reply.annotationId
        ? {
            ...annotation,
            replyCount: annotation.replyCount + 1,
            lastActivityAt: later(annotation.lastActivityAt, reply.createdAt),
          }
        : annotation,
    ),
    reading: {
      ...state.reading,
      replyCount: state.reading.replyCount + 1,
      lastActivityAt: later(state.reading.lastActivityAt, reply.createdAt),
    },
  };
}

/** Merges replies into those shown: one per ID, oldest first. */
export function mergeReplies(shown: Reply[], incoming: Reply[]): Reply[] {
  const byId = new Map([...shown, ...incoming].map((reply) => [reply.id, reply]));
  return [...byId.values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || Number(a.id) - Number(b.id),
  );
}

/** How the annotation list can be ordered. */
export const AnnotationOrder = { Newest: 'newest', RecentActivity: 'recentActivity' } as const;
/** One of the values of `AnnotationOrder`. */
export type AnnotationOrder = (typeof AnnotationOrder)[keyof typeof AnnotationOrder];

/** Orders annotations newest first by when they were posted, or by latest activity. Ties go to the newer ID. */
export function sortAnnotations(annotations: Annotation[], order: AnnotationOrder): Annotation[] {
  const time = (t: Annotation) =>
    order === AnnotationOrder.Newest ? t.createdAt : t.lastActivityAt;
  return [...annotations].sort(
    (a, b) => time(b).localeCompare(time(a)) || Number(b.id) - Number(a.id),
  );
}
