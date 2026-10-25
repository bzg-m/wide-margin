import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Annotation, Reading, Reply } from '../../../shared/api.ts';
import type { CreatePostBody } from '../../../shared/schemas.ts';
import {
  createAnnotation,
  createReply,
  getReading,
  listAnnotations,
  listReplies,
} from '../api/index.ts';
import { applyAnnotation, applyReply, mergeReplies, type DiscussionState } from '../discussion.ts';
import { connectToReading } from '../live.ts';
import { useSession } from './session.ts';
import { Priority, useStatus } from './status.ts';

// Waiting briefly lets a burst of changes share one re-read.
const REREAD_DELAY_MS = 300;
const LIVE_PROBLEM = 'live-updates';

/**
 * The reading being viewed: its details, its annotations, and the replies of each annotation opened,
 * kept current by the reading's event stream. New posts update the counts at once; a re-read
 * from the server then replaces them. See docs/realtime.md.
 */
export const useDiscussion = defineStore('discussion', () => {
  const session = useSession();
  const status = useStatus();

  const readingId = ref<string | null>(null);
  const reading = ref<Reading | null>(null);
  const annotations = ref<Annotation[]>([]);
  const replies = ref<Record<string, Reply[]>>({});
  /** Whether the event stream is connected. */
  const live = ref(false);
  /** Other people's annotations that arrived while the top of the list was out of view. */
  const unseenNewAnnotations = ref(0);

  let counted = new Set<string>();
  let topInView = true;
  let disconnect: (() => void) | undefined;
  let rereadTimer: ReturnType<typeof setTimeout> | undefined;
  // Bumped by every change made here. A load's result is used only if nothing changed after it
  // started, and only if no load that started later has already been used.
  let changes = 0;
  let loadsStarted = 0;
  let newestLoadUsed = 0;

  /**
   * Starts showing a reading, clearing whatever was shown before, and opens its event stream.
   * Load errors are thrown.
   */
  async function show(id: string): Promise<void> {
    leave();
    readingId.value = id;
    connect(id);
    await loadReadingAndAnnotations(id);
  }

  /** Stops showing the reading: closes its event stream and clears its status message. */
  function leave(): void {
    disconnect?.();
    disconnect = undefined;
    clearTimeout(rereadTimer);
    status.resolve(LIVE_PROBLEM);
    readingId.value = null;
    reading.value = null;
    annotations.value = [];
    replies.value = {};
    counted = new Set();
    live.value = false;
    unseenNewAnnotations.value = 0;
  }

  /** Loads an annotation's replies, keeping any already shown. Load errors are thrown. */
  async function loadReplies(annotationId: string): Promise<void> {
    const id = readingId.value!;
    const loaded = await listReplies(id, annotationId);
    if (readingId.value !== id) return;
    replies.value = {
      ...replies.value,
      [annotationId]: mergeReplies(replies.value[annotationId] ?? [], loaded),
    };
  }

  /** Posts an annotation, shows it at once, and schedules a re-read of the counts. */
  async function postAnnotation(body: CreatePostBody, idempotencyKey: string): Promise<void> {
    const id = readingId.value!;
    const annotation = await createAnnotation(id, body, idempotencyKey);
    if (readingId.value === id) addAnnotation(annotation);
  }

  /** Replies to an annotation, shows the reply at once, and schedules a re-read of the counts. */
  async function postReply(
    annotationId: string,
    body: CreatePostBody,
    idempotencyKey: string,
  ): Promise<void> {
    const id = readingId.value!;
    const reply = await createReply(id, annotationId, body, idempotencyKey);
    if (readingId.value === id) addReply(reply);
  }

  /** Tells the store whether the top of the annotation list is on screen. Seeing it clears the unseen count. */
  function setTopInView(inView: boolean): void {
    topInView = inView;
    if (inView) unseenNewAnnotations.value = 0;
  }

  function connect(id: string): void {
    disconnect = connectToReading(id, {
      // Every connection, first or after a drop, re-reads, so anything missed while not
      // listening arrives now.
      onReady: () => {
        live.value = true;
        status.resolve(LIVE_PROBLEM);
        void reread();
        for (const annotationId of Object.keys(replies.value)) {
          loadReplies(annotationId).catch(() => {});
        }
      },
      onAnnotation: (annotation) => {
        const added = addAnnotation(annotation);
        if (added && !topInView && annotation.authorId !== session.user?.id) {
          unseenNewAnnotations.value++;
        }
      },
      onReply: (reply) => void addReply(reply),
      onReconnecting: () => {
        live.value = false;
        status.report({
          id: LIVE_PROBLEM,
          message: 'Live updates paused. Reconnecting…',
          priority: Priority.LiveUpdates,
        });
      },
      onStopped: () => {
        live.value = false;
        status.report({
          id: LIVE_PROBLEM,
          message: 'Live updates stopped.',
          priority: Priority.LiveUpdates,
          action: {
            label: 'Reconnect',
            run: () => {
              status.resolve(LIVE_PROBLEM);
              disconnect?.();
              connect(id);
            },
          },
        });
      },
    });
  }

  // Each returns whether the post was new to this page. Until the reading has loaded there's
  // nothing to add to, and the loads already in progress may have started before the post was
  // saved, so a fresh re-read is scheduled; it starts after the post and so includes it.
  function addAnnotation(annotation: Annotation): boolean {
    if (!reading.value) {
      scheduleReread();
      return false;
    }
    const current = currentState();
    const next = applyAnnotation(current, annotation);
    if (next === current) return false;
    update(next);
    return true;
  }

  function addReply(reply: Reply): boolean {
    if (!reading.value) {
      scheduleReread();
      return false;
    }
    const current = currentState();
    const next = applyReply(current, reply);
    if (next === current) return false;
    update(next);
    return true;
  }

  function currentState(): DiscussionState {
    return {
      reading: reading.value!,
      annotations: annotations.value,
      replies: replies.value,
      counted,
    };
  }

  function update(state: DiscussionState): void {
    reading.value = state.reading;
    annotations.value = state.annotations;
    replies.value = state.replies;
    counted = state.counted;
    changes++;
    scheduleReread();
  }

  function scheduleReread(): void {
    clearTimeout(rereadTimer);
    rereadTimer = setTimeout(() => void reread(), REREAD_DELAY_MS);
  }

  // Loads the reading and its annotations, replacing what's shown unless the result is out of date.
  async function loadReadingAndAnnotations(id: string): Promise<void> {
    const load = ++loadsStarted;
    const changesAtStart = changes;
    const [loadedReading, loadedAnnotations] = await Promise.all([
      getReading(id),
      listAnnotations(id),
    ]);
    const outOfDate = changesAtStart !== changes || load < newestLoadUsed;
    if (readingId.value !== id || outOfDate) return;
    newestLoadUsed = load;
    reading.value = loadedReading;
    annotations.value = loadedAnnotations;
  }

  // If a re-read fails, the counts updated locally stay, and a lost connection is already shown
  // in the status area.
  async function reread(): Promise<void> {
    const id = readingId.value;
    if (id === null) return;
    try {
      await loadReadingAndAnnotations(id);
    } catch {
      // Keep what's shown.
    }
  }

  return {
    reading,
    annotations,
    replies,
    live,
    unseenNewAnnotations,
    show,
    leave,
    loadReplies,
    postAnnotation,
    postReply,
    setTopInView,
  };
});
