# Decisions

Design decisions for the app, grouped by topic, each with the reason behind it.

## Product and UX

- **Sign-in is simulated by picking a seeded user.** Account creation would add forms and edge cases without helping anyone read or discuss.
- **Each surface is one view whose contents depend on permissions.** There is one readings list and one reading view for everyone. In a fuller app a person might teach one class and take another, and a single view per surface extends to that naturally.
- **Permissions are checked in one place.** Code asks `can(user, action)` and never checks `user.role` directly. Today the function reads the user's role. A rule about a specific resource, such as "authors can edit their own posts", would add the resource as a third argument. Posting has no rule yet, because every signed-in user may post. If roles later belong to a membership (user × class × role, including TAs), only this function changes.
- **Replies are the optional enhancement in scope.** They turn a list of comments into conversations, which is the core of a discussion app.
- **Replies are one level deep.** A thread is already one strand of a reading's discussion. Nested branches would split it further and need a tree UI that doesn't fit narrow screens. Supporting them later would take an optional `inReplyToId` field and one database column; most of the work would be in the UI and in deleting replies that have children.
- **Threads keep their place.** Threads are ordered by when they were started, and a new reply does not move its thread. Sorting by last activity is available instead.
- **Instructor posts are marked.** Students can tell guidance from peer discussion at a glance.
- **Sorting happens in the browser and is not saved.** The data is already loaded, so sorting is instant. If the choice should be saved later, a URL parameter (such as `?sort=-annotations`) survives refresh and can be shared.

## Interface

- **New readings are written in a side panel, not in the table.** The list stays usable while the panel is open, so an instructor can sort and scroll existing readings while choosing a title. A form inside the table would break as soon as the table was re-sorted. On phones, the form is its own screen. The table follows its own column's width (a CSS container query), so it becomes cards whenever the panel makes it narrow, not only on phones.
- **The reading view has two columns on wide screens.** The reading's title, description and counts stay in view on the left while the discussion scrolls on the right. On phones they stack, and the description collapses.
- **Threads open in place.** Opening a thread expands its replies beneath it. The same layout works at every screen size, and several threads can be open at once.
- **Composers are multi-line with an explicit Post button.** Enter adds a line, and Ctrl+Enter (or Cmd+Enter) posts. The new-thread box sits above the threads, where new threads appear; the reply box sits at the end of an open thread, after its newest reply. Unsent text is kept as a draft in memory, so leaving a page and coming back (for example, to sign in again) keeps it; a full reload clears it.
- **Live-update status is shown with the discussion, not next to a person.** A dot by a name usually means that person is online. A quiet "Live updates on" line changes to "Reconnecting…" when the stream drops.
- **New threads don't move what you're reading.** If you're scrolled down, a "1 new thread" button appears instead of inserting content above you.
- **Feedback stays proportionate.** A new post appearing is its own confirmation, and a new reading is placed first in the list with a short line confirming it. An error caused by an action appears next to that action. Problems with no triggering action share one status area that shows the most important one, so several failures never stack up.
- **A lost connection is shown only in the status area,** whichever request discovers it, and it clears as soon as any request gets an answer. Pages and actions don't repeat it, so there's one message and one Retry button. The API client reports the connection after every request, which keeps the rule in one place.
- **The app never leaves a page on its own.** When a request finds the sign-in has ended (a 401, for example after signing out in another tab), the status area says so and offers Sign in. The page, and anything typed on it, stays until the user chooses. A refused permission (a 403) is an ordinary error for the action that caused it.
- **Light and dark themes.** The app follows the system setting and offers a manual switch. Every color is a CSS custom property, so a theme is one set of values.
- **"Expand all" is deferred.** With replies loading per thread, expanding every thread would mean one request per thread. An endpoint returning all of a reading's replies would make it cheap, and instructor review is the case that would justify it.
- **Reading titles use a serif font.** The material reads differently from the discussion around it.

## Counting

- **The annotation count includes threads and replies from everyone.** It measures how much discussion a reading has. The UI can show the split.
- **"Students participating" counts students only.** It measures student engagement, which instructor posts would distort.
- **Each counting rule is one query over the `posts` view** (see Data model), so changing a rule is one edit.

## Input

- **Text is normalized rather than restricted to allowed characters.** Academic discussion needs accents, non-Latin scripts and symbols. Script injection is prevented by always displaying text as plain text, and database injection by parameterized queries. Normalizing and removing invisible or deceptive characters handles the remaining unwanted input.
- **Text fields have character limits:** 2,000 for posts and reading descriptions, 200 for reading titles. A character limit works the same in every language and is easy to show with a counter.
- **Characters are counted as Unicode code points everywhere.** The client, the server and the database's `CHECK` constraints then agree, including on emoji.
- **Size assumptions are documented, not enforced.** Up to 100 threads per reading and 30 replies per thread. They justify loading a reading's threads, and a thread's replies, in full. Refusing a 31st reply would be a strange experience.

## API

- **The API is resource-oriented HTTP and JSON.** It follows Google's API Improvement Proposals (AIP) where they don't depend on gRPC, and common HTTP standards elsewhere.
- **Resources:** `users`, `readings`, `readings/{id}/annotations` and `readings/{id}/annotations/{id}/replies`, under `/v1`. Replies sit under their annotation because each belongs to exactly one.
- **Methods are List and Get, plus Create for readings, annotations and replies.** Update and Delete can be added later without breaking clients.
- **Replies load when a thread is opened.** The thread list includes each thread's `replyCount` and `lastActivityAt`, which keeps the first load small.
- **Counts are read-only fields on the reading,** computed by the server, so the readings list needs one call. The participation count is left out of responses for users who may not view it, so the server enforces the rule rather than the UI hiding it.
- **List methods are paginated from the start** (`pageSize`, `pageToken`, `nextPageToken`; 50 items by default, at most 100). Adding pagination later would break clients. The client follows page tokens until none is left. The token encodes a position, which is simple and safe here: threads are newest first and never deleted, so a thread posted mid-load can only cause a repeated item, which the client discards.
- **Errors use RFC 9457 Problem Details** (`application/problem+json`). An `errors` list carries field-level problems for the UI to show next to each field.
- **The stored format and the API format are separate.** A small mapping function per resource turns database rows into API objects and keeps internal columns private, so storage can change without changing the API.
- **Identity travels in a cookie set by the server.** `POST /v1/session` signs in, `GET /v1/session` says who is signed in, and `DELETE /v1/session` signs out. A cookie is the one mechanism that works for both normal requests and the event stream, since `EventSource` cannot send custom headers.

## Real-time updates

How it works end to end is in [realtime.md](realtime.md).

- **Live updates use Server-Sent Events (SSE).** SSE is built into the browser, reconnects on its own, and sends data from server to client, which is all that is needed because writes go through the API. Polling adds delay, and WebSockets add two-way machinery the app doesn't use.
- **There is one stream per reading,** at `GET /v1/readings/{id}/events`. It carries every new thread and reply for that reading, whether or not a thread is open, so the thread list and reply counts stay current.
- **The stream starts with a `ready` event, sent once the server is listening.** The client loads the reading only after `ready`, so nothing posted during loading is missed. The browser's own `open` event can't promise that.
- **Each post is counted once, by ID.** A post can arrive twice, for example your own post in its create response and again from the stream; the second copy changes nothing.
- **Counts update at once, then the server's replace them.** A new post raises its thread's and reading's counts locally, and a re-read from the server about 300 ms later replaces them. A re-read is applied only if nothing changed after it started, so an older response can't undo a newer post. If it fails, the local counts stay.
- **After a reconnect, the client reloads** the thread list and any open thread's replies. That is simpler than replaying missed events, which would need an event log.
- **Only new posts are published.** A retried create with the same `Idempotency-Key` publishes nothing.
- **A heartbeat comment every 25 seconds** keeps proxies from closing a quiet stream.
- **Concurrent posts never conflict.** Replies are all accepted and ordered by server time. If editing is added, ETags would prevent one edit from silently overwriting another.
- **Known limits at scale:** several server instances would need a shared message channel; some proxies buffer responses and must be told not to; HTTP/1.1 allows a browser about 6 connections per site, which HTTP/2 lifts.

## Reliability and caching

- **Failed requests are retried automatically** after network errors, 5xx and 429 responses, with growing randomized delays, up to three times. Only requests that are safe to repeat are retried: reads, creates carrying an idempotency key, and signing in or out. Other 4xx responses are not retried. A 502, 503 or 504 with no details is reported as "Can't reach the server", since that's what a proxy sends when the server behind it is down.
- **Creates are safe to retry.** Each carries an `Idempotency-Key` header, which the server stores with a uniqueness constraint. A repeated key returns the resource created the first time, and the same key with different content is rejected with a 422, as the IETF `Idempotency-Key` draft specifies. The client reuses a key only while the content is unchanged; edited content is a new request with a new key. After a create succeeds, the list refreshes, so an earlier send that reached the server before a lost connection also appears.
- **There is no caching layer.** The data changes often and the stream keeps it current. The browser caches build files, and the client keeps loaded data in memory between views. At scale, stored counters and ETags would come first.

## Security

- **Sign-in is simulated, and the docs say so.** The cookie holds a user ID with no signature, so anyone can claim to be anyone. Real authentication would replace the cookie's contents, not the way it travels.
- **The cookie is `HttpOnly` and `SameSite=Lax`.** Page scripts can't read it, and browsers don't send it with requests that other sites start, which is the main defense against cross-site request forgery.
- **Writes accept only JSON.** Another site can't send a JSON request without a CORS preflight, and the server never approves one.
- **Hono's `csrf()` middleware rejects form submissions from other sites,** checking the `Origin` and `Sec-Fetch-Site` headers. It covers the classic attack even in a browser that ignores `SameSite`.

## Data model

- **Tables:** `users`, `readings`, `annotations` and `replies`. A reply points to its annotation and has no reading of its own, so the schema guarantees that replies are one level deep and belong to their annotation's reading. Each table matches one API resource.
- **A `posts` view combines annotations and replies,** each row tagged as a thread or a reply.
- **IDs are integers in the database and strings in the API.** Integers are easy to work with while debugging, and switching to opaque IDs later wouldn't change the API.
- **Timestamps are set by the server** as ISO 8601 UTC text with milliseconds, for example `2026-10-24T15:04:05.123Z`. They are readable and sort correctly as text. Ties are broken by ID.
- **Idempotency keys are unique per user,** so one user's keys can't collide with another's. Sending a key is optional in the API.

## Database

- **SQLite, behind a small data layer.** It needs no setup, so a fresh clone runs. The data is relational: users, readings, annotations and replies, with counts and distinct participants.
- **Each index serves a known query:** the readings list, a reading's threads, a thread's replies, and idempotency-key lookups.
- **Foreign keys are enforced.** SQLite itself leaves them off by default. Node's driver turns them on, and the code requests it explicitly.
- **Tables are `STRICT`.** By default SQLite stores any value in any column; strict tables enforce the declared types.
- **The schema is created at startup, and a new database is seeded with sample data.** A fresh clone runs with no extra setup, and `npm run db:reset` starts over. A real deployment would use versioned migrations.
- **Changing databases would mean rewriting the data layer, not the app.** A document store, for example, would replace joins with lookups and distinct counts with aggregations or stored counters, behind the same functions.
- **Some future data suits other stores.** Reading content (PDFs, video) belongs in object storage. Reading metadata that varies by type, and annotation anchors (a text range, a video timestamp, an image region), are document-shaped. A JSON column would also work.

## Stack and tooling

- **Node 26, pinned.** It is the active long-term-support release. `.nvmrc`, `engines` and `engine-strict` make `npm install` stop with a clear message on any other version.
- **The server's TypeScript runs directly on Node,** with no build step; `tsc` only checks types. The `erasableSyntaxOnly` setting rules out syntax Node can't run, such as enums.
- **One package with `client/`, `server/` and `shared/` folders.** There is one install. Shared code is imported by relative path, because Node doesn't strip types from packages inside `node_modules`.
- **SQLite through Node's built-in `node:sqlite`.** There is nothing to install or compile. The module is at release-candidate stability; the driver is used in one file, so `better-sqlite3` is an easy fallback.
- **Hono for the server.** It is small and readable, has built-in helpers for SSE and cookies, and can serve test requests without a running server.
- **Zod schemas in `shared/`** validate requests on the server, give the client the same checks, and provide the TypeScript types.
- **Vue 3, Vite, Vue Router and Pinia for the client.** Pinia is Vue's official store, and its setup stores read like plain functions.
- **No UI or date libraries.** Styling is plain CSS with custom properties and scoped component styles, so the design is the app's own. Relative times use the browser's `Intl.RelativeTimeFormat`.
- **One command runs everything in development.** Vite and the server start together, and Vite forwards `/v1` to the server. The page, the API and the event stream then share one origin, so cookies and SSE need no cross-origin setup. The API reads its port from `API_PORT` rather than `PORT`, which tools often set for the page's own server, and Vite refuses to start on any port but 5173 rather than moving silently.
- **Vitest for tests; `vue-tsc`, ESLint and Prettier for checks.** Components with behavior of their own, such as the post box, are tested with `@vue/test-utils` in `happy-dom`, a lightweight stand-in for a browser. Other tests run in plain Node.
- **Tests check behavior, not implementation.** They are written alongside each change and follow Vitest conventions. Each test protects one rule (for example, "a retried create never makes a duplicate"), so a broken rule fails one test with a clear name. Tests don't restate the code or try every combination of inputs.
- **The OpenAPI description is deferred.** Generating it with `@hono/zod-openapi` would make every route more verbose. Zod can export JSON Schema, so a hand-written description can reuse the schemas later.

## Open

- **Optional enhancements:** filter by student, search, a participation dashboard, editing and deleting.
- **Edited retries after a lost connection:** if the first send was saved before the connection dropped, sending an edited version creates a second reading. Editing readings would let the app offer to apply the changes to the saved one instead.
