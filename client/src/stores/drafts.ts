import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Attempt } from '../idempotency.ts';
import { useSession } from './session.ts';

/** A form's unsent field values, and its last unsuccessful send. */
export type Draft = { fields: Record<string, string>; lastAttempt?: Attempt<unknown> };

/**
 * Unsent drafts by form, such as "annotation:3", "reply:17" or "reading:new". They're kept while the
 * page is open, so leaving a page (for example, to sign in again) and coming back keeps the text.
 * Each user has their own drafts.
 */
export const useDrafts = defineStore('drafts', () => {
  const session = useSession();
  const drafts = ref<Record<string, Draft>>({});

  // Drafts belong to the user who typed them, so switching users never offers one person's
  // words (or their pending send) to another.
  const userKey = (key: string) => `${session.user?.id ?? 'nobody'}:${key}`;

  /** The signed-in user's draft for a form, created empty if there isn't one yet. */
  function draftFor(key: string): Draft {
    const scoped = userKey(key);
    if (!drafts.value[scoped]) drafts.value[scoped] = { fields: {} };
    return drafts.value[scoped];
  }

  /** Empties the signed-in user's draft for a form once it has been sent or discarded. It stays the same object. */
  function clear(key: string): void {
    const draft = drafts.value[userKey(key)];
    if (!draft) return;
    draft.fields = {};
    draft.lastAttempt = undefined;
  }

  return { draftFor, clear };
});
