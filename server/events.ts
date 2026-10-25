import type { ReadingEvent } from '../shared/api.ts';

type Listener = (event: ReadingEvent) => void;

/**
 * Passes events about a reading to everyone listening to that reading. It lives in this process's
 * memory, so it only reaches listeners connected to this server. See docs/realtime.md.
 */
export class ReadingEvents {
  /** Each reading's listeners, keyed by reading ID. */
  private listeners = new Map<string, Set<Listener>>();

  /**
   * Starts sending a reading's events to the listener. Returns a function that stops it.
   * Subscribing the same function twice has no extra effect, and either returned function unsubscribes it.
   */
  subscribe(readingId: string, listener: Listener): () => void {
    let readingListeners = this.listeners.get(readingId);
    if (!readingListeners) {
      readingListeners = new Set();
      this.listeners.set(readingId, readingListeners);
    }
    readingListeners.add(listener);
    return () => {
      readingListeners.delete(listener);
      if (readingListeners.size === 0) this.listeners.delete(readingId);
    };
  }

  /** Sends an event to everyone listening to the reading. */
  publish(readingId: string, event: ReadingEvent): void {
    for (const listener of this.listeners.get(readingId) ?? []) listener(event);
  }
}
