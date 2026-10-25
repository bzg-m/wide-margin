import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventName, HEARTBEAT_INTERVAL_MS } from '../../shared/api.ts';
import { connectToReading, type LiveHandlers } from './live.ts';

/** Stands in for the browser's EventSource: tests send events and errors through it. */
class FakeEventSource extends EventTarget {
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;
  readyState = this.OPEN;
  readonly url: string;
  close = vi.fn(() => {
    this.readyState = this.CLOSED;
  });

  constructor(url: string) {
    super();
    this.url = url;
  }

  /** Sends a named event with JSON data, as the server would. */
  send(name: string, data: unknown = '') {
    this.dispatchEvent(new MessageEvent(name, { data: JSON.stringify(data) }));
  }

  /** Reports an error, leaving the stream in the given state as the browser would. */
  fail(readyState: number) {
    this.readyState = readyState;
    this.dispatchEvent(new Event('error'));
  }
}

// Longer than any reasonable silence limit.
const A_MINUTE = 60_000;

function connect() {
  const handlers: LiveHandlers = {
    onReady: vi.fn(),
    onThread: vi.fn(),
    onReply: vi.fn(),
    onReconnecting: vi.fn(),
    onStopped: vi.fn(),
  };
  const sources: FakeEventSource[] = [];
  const close = connectToReading('7', handlers, (url) => {
    const source = new FakeEventSource(url);
    sources.push(source);
    return source as unknown as EventSource;
  });
  return { handlers, sources, source: sources[0], close };
}

describe('connectToReading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes the reading's new threads and replies to their handlers", () => {
    const { handlers, source } = connect();

    source.send(EventName.AnnotationCreated, { id: '1', text: 'A thread' });
    source.send(EventName.ReplyCreated, { id: '2', text: 'A reply' });

    expect(source.url).toBe('/v1/readings/7/events');
    expect(handlers.onThread).toHaveBeenCalledWith({ id: '1', text: 'A thread' });
    expect(handlers.onReply).toHaveBeenCalledWith({ id: '2', text: 'A reply' });
  });

  it('reports reconnecting when the connection drops, and stopped when it closes for good', () => {
    const { handlers, source } = connect();

    source.fail(source.CONNECTING);
    source.fail(source.CLOSED);

    expect(handlers.onReconnecting).toHaveBeenCalledTimes(1);
    expect(handlers.onStopped).toHaveBeenCalledTimes(1);
  });

  it('replaces a stream that has gone quiet, and reports reconnecting', () => {
    const { handlers, sources } = connect();
    sources[0].send(EventName.Ready);

    vi.advanceTimersByTime(A_MINUTE);

    expect(sources[0].close).toHaveBeenCalled();
    expect(handlers.onReconnecting).toHaveBeenCalled();
    expect(sources[1]?.url).toBe(sources[0].url);
  });

  it('keeps a stream open while heartbeats arrive', () => {
    const { handlers, sources } = connect();
    sources[0].send(EventName.Ready);

    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
      sources[0].send(EventName.Heartbeat);
    }

    expect(sources).toHaveLength(1);
    expect(handlers.onReconnecting).not.toHaveBeenCalled();
  });

  it("doesn't reopen a stream that has stopped for good", () => {
    const { handlers, sources } = connect();

    sources[0].fail(sources[0].CLOSED);
    vi.advanceTimersByTime(A_MINUTE);

    expect(sources).toHaveLength(1);
    expect(handlers.onReconnecting).not.toHaveBeenCalled();
  });

  it("closes the stream when asked, and doesn't reopen it", () => {
    const { sources, close } = connect();

    close();
    vi.advanceTimersByTime(A_MINUTE);

    expect(sources[0].close).toHaveBeenCalled();
    expect(sources).toHaveLength(1);
  });
});
