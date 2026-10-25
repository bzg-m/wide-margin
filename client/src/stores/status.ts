import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

/** How important a status problem is. When several are active, the most important is shown. */
export const Priority = { LiveUpdates: 1, Server: 2, SignedOut: 3 } as const;
/** One of the values of `Priority`. */
export type Priority = (typeof Priority)[keyof typeof Priority];

/** A problem not caused by something the user just did, such as losing the connection. */
export type StatusProblem = {
  /** Names the problem: reporting the same id again replaces it, and `resolve(id)` clears it. */
  id: string;
  /** The sentence shown to the user. */
  message: string;
  priority: Priority;
  /**
   * If given, the status area shows a button with this label that calls `run`. It should start
   * over whatever failed, or take the user where they can fix it. The problem stays shown until
   * something calls `resolve`, which `run` itself may do.
   */
  action?: { label: string; run: () => void };
};

/** Problems shown in the status area, one at a time, so several failures never stack up. */
export const useStatus = defineStore('status', () => {
  const problems = ref<StatusProblem[]>([]);

  /** The problem to show: the most important, and the most recent among equals. */
  const current = computed(() =>
    problems.value.reduce<StatusProblem | undefined>(
      (shown, problem) => (!shown || problem.priority >= shown.priority ? problem : shown),
      undefined,
    ),
  );

  /** Reports a problem, replacing any earlier one with the same id. */
  function report(problem: StatusProblem): void {
    problems.value = [...problems.value.filter((p) => p.id !== problem.id), problem];
  }

  /** Clears the problem with this id, if any. */
  function resolve(id: string): void {
    problems.value = problems.value.filter((p) => p.id !== id);
  }

  return { current, report, resolve };
});
