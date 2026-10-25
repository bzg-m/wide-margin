import { ref, type Ref } from 'vue';

const TICK_MS = 30_000;

const now = ref(Date.now());
let ticking = false;

/**
 * The current time, updated every 30 seconds, so relative times such as "5 minutes ago" stay
 * current while a page is open. One shared timer serves every caller.
 */
export function useNow(): Readonly<Ref<number>> {
  if (!ticking) {
    ticking = true;
    setInterval(() => (now.value = Date.now()), TICK_MS);
  }
  return now;
}
