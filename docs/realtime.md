# Live updates

New annotations and replies appear for everyone viewing a reading without a page refresh. This page explains how, from the wire format to what the browser does with each event.

## Server-Sent Events

Server-Sent Events (SSE) is a standard way for a server to push messages to a browser over plain HTTP. The browser makes one ordinary `GET` request, and the server keeps the response open, writing an event whenever it has one.

The response is plain text. Each event is a few `field: value` lines followed by a blank line:

```
event: annotation.created
data: {"id":"12","text":"Why divide by the square root?", ...}

event: heartbeat
data:

event: reply.created
data: {"id":"40","annotationId":"12", ...}

```

`event` names the kind of message and `data` carries it, here as JSON. A line starting with `:` is a comment, which the browser reads but never passes to the page.

SSE only sends from server to client. That's all the app needs, because posting goes through the normal API.

## The stream for a reading

Each reading has its own stream at `GET /v1/readings/:readingId/events` ([server/routes/readings.ts](../server/routes/readings.ts)). It sends four events, named in `EventName` ([shared/api.ts](../shared/api.ts)):

| Event                | Data                 | Sent when                                                        |
| -------------------- | -------------------- | ---------------------------------------------------------------- |
| `ready`              | none                 | The stream is listening. Anything posted after this arrives.     |
| `heartbeat`          | none                 | Every 15 seconds, so a quiet stream can be told from a dead one. |
| `annotation.created` | the new `Annotation` | Someone posts an annotation on the reading.                      |
| `reply.created`      | the new `Reply`      | Someone replies to one of the reading's annotations.             |

The stream requires a signed-in user like the rest of the API. The browser's `EventSource` sends the sign-in cookie, because the page and the API share one origin.

## How one post reaches every viewer

```
POST …/annotations ──► createAnnotation ──► events.publish(readingId, event)
                                              │
                         ┌────────────────────┼────────────────────┐
                         ▼                    ▼                    ▼
                  stream for Sarah     stream for Michael    stream for Dr. Lee
```

`ReadingEvents` ([server/events.ts](../server/events.ts)) keeps a list of listeners for each reading:

1. When a stream opens, it **subscribes** a listener for its reading. The listener writes each event it receives into that stream's response.
2. When an annotation or reply is created, the route **publishes** an event for the reading ([server/routes/annotations.ts](../server/routes/annotations.ts)). Every listener for that reading gets it.
3. A retried create with the same `Idempotency-Key` publishes nothing, because the post isn't new.

Publishing doesn't wait for each write to finish, so a slow connection doesn't hold up the others or the request that made the post.

## Inside the stream

Hono's `streamSSE` returns a response whose body stays open while its callback runs. In Node, each write goes out to the browser as soon as it's made. The callback:

1. **Subscribes** to the reading's events.
2. **Sends `ready`.** Because the subscription already exists, a client that has seen `ready` can't miss anything posted afterwards. The browser's own `open` event isn't enough for this, because it fires when the response headers arrive, which says nothing about the subscription.
3. **Sends a `heartbeat` event every 15 seconds** until the connection closes. It does two jobs. Proxies often close connections that have been silent for 30 to 60 seconds, and the heartbeat keeps the stream from looking idle. It also lets the client tell a quiet stream from a dead one, which is why it is a named event: `EventSource` never passes comments to the page.

## Disconnecting

When the browser closes the connection (the tab closes, or the user leaves the reading), Hono marks the stream as aborted. The `onAbort` handler unsubscribes the listener, so the reading stops sending to it, and the heartbeat loop ends when it next wakes.

The browser's `EventSource` reconnects on its own after an unexpected drop, such as the server restarting. After an error response, such as a 401 or 404, it closes the stream for good.

The browser can't always tell that a connection has died. A network can drop without a word, and a proxy can keep the browser's side open after the server behind it has stopped. The client covers this itself, as described below.

## What the client does with events

The client's side lives in [client/src/live.ts](../client/src/live.ts), which wraps `EventSource`, and the discussion store, [client/src/stores/discussion.ts](../client/src/stores/discussion.ts). It follows these rules:

- **Every `ready` means re-read.** The page loads the reading straight away, so it appears quickly, and opens the stream alongside. Each `ready`, on the first connection and after every reconnect, re-reads the reading and its annotations, and reloads every loaded annotation's replies with one request for the whole reading. Anything posted before the stream was listening, or while it was disconnected, arrives that way. Events carry no IDs, so the server can't replay what was missed; re-reading is simpler and always correct.
- **Each post is counted once, by ID.** The author's own post arrives twice, once in the create response and once on the stream. The second copy changes nothing.
- **Counts update at once, then the server's replace them.** A new post, from the stream or your own, raises its annotation's and reading's counts and moves their last activity. About 300 ms later, a re-read from the server replaces them.
- **Only an up-to-date re-read is applied.** A re-read that started before a later change, or before another re-read that has already been applied, is ignored. An older response can therefore never undo a newer post. A post that arrives before the reading has first loaded schedules a fresh re-read, which starts after the post and so includes it.
- **A reply can briefly be counted twice.** A re-read returns counts, not the replies behind them, so if its counts already include a reply whose event arrives afterwards, the event adds one more. That event also schedules a re-read, which corrects the count within about 300 ms plus a request. Making it exact would mean events carrying the server's counts, which isn't worth it for a blip that fixes itself.
- **A quiet stream is replaced.** Every event, heartbeats included, shows the stream is alive. After 30 seconds with none, twice the heartbeat interval, the client closes the stream, reports that it is reconnecting and opens a new one, whose `ready` re-reads as usual. A stream closed for good is left closed until the user asks to reconnect.
- **Problems show in the status area.** A dropped connection shows "Live updates paused. Reconnecting…", and a stream closed for good shows "Live updates stopped." with a Reconnect button. Both rank below "Can't reach the server", so a server outage shows one message. While connected, the discussion shows a quiet "Live updates on".
- **New annotations don't move what you're reading.** When the top of the annotation list is out of view, a button counts other people's new annotations and scrolls up when clicked. Chrome, Edge and Firefox also keep the page still as annotations are added above, using scroll anchoring. Safari doesn't support scroll anchoring, so there the page shifts down by the new annotation's height.

## Limits at scale

`ReadingEvents` lives in the server's memory, which shapes what changes at scale:

- **Several server instances** would each have their own listeners, so an event published on one wouldn't reach viewers connected to another. A shared channel, such as Redis publish/subscribe or MongoDB change streams, would carry events between instances.
- **HTTP/1.1 allows a browser about 6 connections per site,** so many open tabs could exhaust them. HTTP/2 removes this limit.
- **Some proxies buffer responses,** which delays events until a buffer fills. Nginx, for example, needs the `X-Accel-Buffering: no` header or buffering turned off for the stream's path.
