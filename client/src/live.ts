import { EventName, type Annotation, type Reply } from '../../shared/api.ts';

/** What can happen on a reading's event stream. See docs/realtime.md. */
export type LiveHandlers = {
  /** The stream is listening. Fires on the first connection and again after every reconnect. */
  onReady: () => void;
  /** Someone started a thread on the reading. */
  onThread: (thread: Annotation) => void;
  /** Someone replied in one of the reading's threads. */
  onReply: (reply: Reply) => void;
  /** The connection dropped, and the browser is trying to reconnect. */
  onReconnecting: () => void;
  /** The browser has given up, for example after an error response such as a 401 or 404. */
  onStopped: () => void;
};

/** Creates an EventSource for a URL. Tests pass a fake. */
export type EventSourceFactory = (url: string) => EventSource;

/** Opens a reading's event stream and passes what happens to `handlers`. Returns a function that closes it. */
export function connectToReading(
  readingId: string,
  handlers: LiveHandlers,
  createEventSource: EventSourceFactory = (url) => new EventSource(url),
): () => void {
  const source = createEventSource(`/v1/readings/${encodeURIComponent(readingId)}/events`);
  const dataOf = (event: Event) => JSON.parse((event as MessageEvent<string>).data);

  source.addEventListener(EventName.Ready, () => handlers.onReady());
  source.addEventListener(EventName.AnnotationCreated, (event) => handlers.onThread(dataOf(event)));
  source.addEventListener(EventName.ReplyCreated, (event) => handlers.onReply(dataOf(event)));
  // After a dropped connection the browser reconnects by itself, but after an error response it
  // closes the stream for good.
  source.addEventListener('error', () => {
    if (source.readyState === source.CLOSED) handlers.onStopped();
    else handlers.onReconnecting();
  });

  return () => source.close();
}
