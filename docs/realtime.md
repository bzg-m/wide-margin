# Live updates

New threads and replies appear for everyone viewing a reading without a page refresh. This page explains how, from the wire format to what the browser does with each event.

## Server-Sent Events

Server-Sent Events (SSE) is a standard way for a server to push messages to a browser over plain HTTP. The browser makes one ordinary `GET` request, and the server keeps the response open, writing an event whenever it has one.

The response is plain text. Each event is a few `field: value` lines followed by a blank line:

```
event: annotation.created
data: {"id":"12","text":"Why divide by the square root?", ...}

: heartbeat

event: reply.created
data: {"id":"40","annotationId":"12", ...}

```

`event` names the kind of message and `data` carries it, here as JSON. A line starting with `:` is a comment, which the browser ignores.

SSE only sends from server to client. That's all the app needs, because posting goes through the normal API.

## The stream for a reading

Each reading has its own stream at `GET /v1/readings/:readingId/events` ([server/routes/readings.ts](../server/routes/readings.ts)). It sends three events, named in `EventName` ([shared/api.ts](../shared/api.ts)):

| Event                | Data                 | Sent when                                                    |
| -------------------- | -------------------- | ------------------------------------------------------------ |
| `ready`              | none                 | The stream is listening. Anything posted after this arrives. |
| `annotation.created` | the new `Annotation` | Someone starts a thread on the reading.                      |
| `reply.created`      | the new `Reply`      | Someone replies in one of the reading's threads.             |

The stream requires a signed-in user like the rest of the API. The browser's `EventSource` sends the sign-in cookie, because the page and the API share one origin.

## How one post reaches every viewer

```
POST …/annotations ──► createThread ──► events.publish(readingId, event)
                                              │
                         ┌────────────────────┼────────────────────┐
                         ▼                    ▼                    ▼
                  stream for Sarah     stream for Michael    stream for Dr. Lee
```

`ReadingEvents` ([server/events.ts](../server/events.ts)) keeps a list of listeners for each reading:

1. When a stream opens, it **subscribes** a listener for its reading. The listener writes each event it receives into that stream's response.
2. When a thread or reply is created, the route **publishes** an event for the reading ([server/routes/annotations.ts](../server/routes/annotations.ts)). Every listener for that reading gets it.
3. A retried create with the same `Idempotency-Key` publishes nothing, because the post isn't new.

Publishing doesn't wait for each write to finish, so a slow connection doesn't hold up the others or the request that made the post.

## Inside the stream

Hono's `streamSSE` returns a response whose body stays open while its callback runs. In Node, each write goes out to the browser as soon as it's made. The callback:

1. **Subscribes** to the reading's events.
2. **Sends `ready`.** Because the subscription already exists, a client that has seen `ready` can't miss anything posted afterwards. The browser's own `open` event isn't enough for this, because it fires when the response headers arrive, which says nothing about the subscription.
3. **Sends a heartbeat comment every 25 seconds** until the connection closes. Proxies often close connections that have been silent for 30 to 60 seconds; the heartbeat keeps the stream from looking idle.

## Disconnecting

When the browser closes the connection (the tab closes, or the user leaves the reading), Hono marks the stream as aborted. The `onAbort` handler unsubscribes the listener, so the reading stops sending to it, and the heartbeat loop ends when it next wakes.

The browser's `EventSource` reconnects on its own after an unexpected drop, such as the server restarting.

## What the client does with events

The client follows these rules:

- **Open the stream first, and load the reading after `ready`.** Loading first would leave a gap: anything posted between the load and the subscription would be lost.
- **Merge everything by ID.** The author's own post arrives twice, once in the create response and once on the stream, and must appear once.
- **Merge fetched data into what's on screen; never replace it.** A fetch can return a snapshot taken just before a new reply was saved, after that reply's event has already arrived. Replacing the list with the fetch result would lose the reply.
- **After a reconnect, reload** the thread list and the replies of any open thread. Events carry no IDs, so the server can't replay what was missed; reloading is simpler and always correct.
- **Update counts from events.** A `reply.created` event raises its thread's reply count and moves its last-activity time, whether or not the thread is open.

## Limits at scale

`ReadingEvents` lives in the server's memory, which shapes what changes at scale:

- **Several server instances** would each have their own listeners, so an event published on one wouldn't reach viewers connected to another. A shared channel, such as Redis publish/subscribe or MongoDB change streams, would carry events between instances.
- **HTTP/1.1 allows a browser about 6 connections per site,** so many open tabs could exhaust them. HTTP/2 removes this limit.
- **Some proxies buffer responses,** which delays events until a buffer fills. Nginx, for example, needs the `X-Accel-Buffering: no` header or buffering turned off for the stream's path.
