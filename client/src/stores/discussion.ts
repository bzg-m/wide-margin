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
import { applyReply, applyThread, mergeReplies, type DiscussionState } from '../discussion.ts';

// Waiting briefly lets a burst of changes share one re-read.
const REREAD_DELAY_MS = 300;

/**
 * The reading being viewed: its details, its threads, and the replies of each thread opened.
 * New posts update the counts at once; a re-read from the server then replaces them.
 */
export const useDiscussion = defineStore('discussion', () => {
  const readingId = ref<string | null>(null);
  const reading = ref<Reading | null>(null);
  const threads = ref<Annotation[]>([]);
  const replies = ref<Record<string, Reply[]>>({});
  let counted = new Set<string>();
  // Bumped by every local change. A re-read is applied only if no change happened after it started.
  let changes = 0;
  let rereadTimer: ReturnType<typeof setTimeout> | undefined;

  /** Starts showing a reading, clearing whatever was shown before. Load errors are thrown. */
  async function show(id: string): Promise<void> {
    clearTimeout(rereadTimer);
    readingId.value = id;
    reading.value = null;
    threads.value = [];
    replies.value = {};
    counted = new Set();
    const [loadedReading, loadedThreads] = await Promise.all([getReading(id), listAnnotations(id)]);
    if (readingId.value !== id) return; // Another reading was opened meanwhile.
    reading.value = loadedReading;
    threads.value = loadedThreads;
  }

  /** Loads a thread's replies, keeping any already shown. Load errors are thrown. */
  async function loadReplies(annotationId: string): Promise<void> {
    const id = readingId.value!;
    const loaded = await listReplies(id, annotationId);
    if (readingId.value !== id) return;
    replies.value = {
      ...replies.value,
      [annotationId]: mergeReplies(replies.value[annotationId] ?? [], loaded),
    };
  }

  /** Starts a thread, shows it at once, and schedules a re-read of the counts. */
  async function postThread(body: CreatePostBody, idempotencyKey: string): Promise<void> {
    const id = readingId.value!;
    const thread = await createAnnotation(id, body, idempotencyKey);
    if (readingId.value !== id) return;
    update(applyThread(currentState(), thread));
  }

  /** Replies in a thread, shows the reply at once, and schedules a re-read of the counts. */
  async function postReply(
    annotationId: string,
    body: CreatePostBody,
    idempotencyKey: string,
  ): Promise<void> {
    const id = readingId.value!;
    const reply = await createReply(id, annotationId, body, idempotencyKey);
    if (readingId.value !== id) return;
    update(applyReply(currentState(), reply));
  }

  function currentState(): DiscussionState {
    return { reading: reading.value!, threads: threads.value, replies: replies.value, counted };
  }

  function update(state: DiscussionState): void {
    reading.value = state.reading;
    threads.value = state.threads;
    replies.value = state.replies;
    counted = state.counted;
    changes++;
    clearTimeout(rereadTimer);
    rereadTimer = setTimeout(() => void reread(), REREAD_DELAY_MS);
  }

  // Replaces the counts with the server's. If it fails, the counts updated locally stay, and a
  // lost connection is already shown in the status area.
  async function reread(): Promise<void> {
    const id = readingId.value!;
    const startedAt = changes;
    try {
      const [freshReading, freshThreads] = await Promise.all([getReading(id), listAnnotations(id)]);
      // Something changed after this started, so it may be missing that change.
      if (startedAt !== changes || readingId.value !== id) return;
      reading.value = freshReading;
      threads.value = freshThreads;
    } catch {
      // Keep the locally updated counts.
    }
  }

  return { reading, threads, replies, show, loadReplies, postThread, postReply };
});
