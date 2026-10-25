import { EventName, HEARTBEAT_INTERVAL_MS, type Annotation, type Reply } from '../../shared/api.ts';

// Twice the heartbeat interval, so one late heartbeat doesn't count as silence.
const SILENCE_LIMIT_MS = 2 * HEARTBEAT_INTERVAL_MS;

/** What can happen on a reading's event stream. See docs/realtime.md. */
export type LiveHandlers = {
  /** The stream is listening. Fires on the first connection and again after every reconnect. */
  onReady: () => void;
  /** Someone posted an annotation on the reading. */
  onAnnotation: (annotation: Annotation) => void;
  /** Someone replied to one of the reading's annotations. */
  onReply: (reply: Reply) => void;
  /** The connection dropped or went quiet, and the stream is being reopened. */
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
  const url = `/v1/readings/${encodeURIComponent(readingId)}/events`;
  const dataOf = (event: Event) => JSON.parse((event as MessageEvent<string>).data);
  let source: EventSource;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;

  // The browser can't always tell that a connection has died: a network can drop without a
  // word, and a proxy can keep its side open after the server behind it has stopped. Any event,
  // heartbeats included, shows the stream is alive; after too long without one, it's replaced.
  function heardFromServer() {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      source.close();
      handlers.onReconnecting();
      open();
    }, SILENCE_LIMIT_MS);
  }

  function open() {
    const current = createEventSource(url);
    source = current;
    current.addEventListener(EventName.Ready, () => {
      heardFromServer();
      handlers.onReady();
    });
    current.addEventListener(EventName.Heartbeat, heardFromServer);
    current.addEventListener(EventName.AnnotationCreated, (event) => {
      heardFromServer();
      handlers.onAnnotation(dataOf(event));
    });
    current.addEventListener(EventName.ReplyCreated, (event) => {
      heardFromServer();
      handlers.onReply(dataOf(event));
    });
    // After a dropped connection the browser reconnects by itself, but after an error response
    // it closes the stream for good, and only the user's Reconnect opens it again.
    current.addEventListener('error', () => {
      if (current.readyState === current.CLOSED) {
        clearTimeout(silenceTimer);
        handlers.onStopped();
      } else {
        handlers.onReconnecting();
      }
    });
    heardFromServer();
  }

  open();
  return () => {
    clearTimeout(silenceTimer);
    source.close();
  };
}
