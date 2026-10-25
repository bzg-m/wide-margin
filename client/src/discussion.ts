import type { Annotation, Reading, Reply } from '../../shared/api.ts';

/** What a reading's discussion shows, as far as new posts are concerned. */
export type DiscussionState = {
  reading: Reading;
  threads: Annotation[];
  /** Loaded replies by annotation ID. A thread has an entry once its replies have been loaded. */
  replies: Record<string, Reply[]>;
  /**
   * Posts already counted since the page opened, as "thread:ID" or "reply:ID", so a post that
   * arrives twice (in its create response and again as an event) is counted once.
   */
  counted: Set<string>;
};

// ISO 8601 times in UTC sort correctly as text.
const later = (a: string | null, b: string) => (a !== null && a > b ? a : b);

/** Adds a new thread, counting it on the reading unless it's already shown or counted. */
export function applyThread(state: DiscussionState, thread: Annotation): DiscussionState {
  const key = `thread:${thread.id}`;
  if (state.counted.has(key)) return state;
  const counted = new Set(state.counted).add(key);
  // Already in the list from a fetch, which counted it on the server.
  if (state.threads.some((t) => t.id === thread.id)) return { ...state, counted };
  return {
    ...state,
    counted,
    threads: [thread, ...state.threads],
    reading: {
      ...state.reading,
      threadCount: state.reading.threadCount + 1,
      lastActivityAt: later(state.reading.lastActivityAt, thread.createdAt),
    },
  };
}

/** Adds a new reply, counting it on its thread and reading unless it's already shown or counted. */
export function applyReply(state: DiscussionState, reply: Reply): DiscussionState {
  const key = `reply:${reply.id}`;
  if (state.counted.has(key)) return state;
  const counted = new Set(state.counted).add(key);
  const loaded = state.replies[reply.annotationId];
  // Already in the thread's replies from a fetch, which counted it on the server.
  if (loaded?.some((r) => r.id === reply.id)) return { ...state, counted };
  return {
    ...state,
    counted,
    replies: loaded
      ? { ...state.replies, [reply.annotationId]: mergeReplies(loaded, [reply]) }
      : state.replies,
    threads: state.threads.map((thread) =>
      thread.id === reply.annotationId
        ? {
            ...thread,
            replyCount: thread.replyCount + 1,
            lastActivityAt: later(thread.lastActivityAt, reply.createdAt),
          }
        : thread,
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

/** How the thread list can be ordered. */
export const ThreadOrder = { Newest: 'newest', RecentActivity: 'recentActivity' } as const;
/** One of the values of `ThreadOrder`. */
export type ThreadOrder = (typeof ThreadOrder)[keyof typeof ThreadOrder];

/** Orders threads newest first by when they were started, or by latest activity. Ties go to the newer ID. */
export function sortThreads(threads: Annotation[], order: ThreadOrder): Annotation[] {
  const time = (t: Annotation) => (order === ThreadOrder.Newest ? t.createdAt : t.lastActivityAt);
  return [...threads].sort((a, b) => time(b).localeCompare(time(a)) || Number(b.id) - Number(a.id));
}
