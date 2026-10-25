import { describe, expect, it, vi } from 'vitest';
import { EventName } from '../../shared/api.ts';
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

function connect() {
  const handlers: LiveHandlers = {
    onReady: vi.fn(),
    onThread: vi.fn(),
    onReply: vi.fn(),
    onReconnecting: vi.fn(),
    onStopped: vi.fn(),
  };
  let source!: FakeEventSource;
  const close = connectToReading('7', handlers, (url) => {
    source = new FakeEventSource(url);
    return source as unknown as EventSource;
  });
  return { handlers, source, close };
}

describe('connectToReading', () => {
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

  it('closes the stream when asked', () => {
    const { source, close } = connect();

    close();

    expect(source.close).toHaveBeenCalled();
  });
});
