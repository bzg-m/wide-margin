# Decisions

Design decisions for the app, grouped by topic, each with the reason behind it.

## Product and UX

- **Sign-in is simulated by picking a seeded user.** Account creation would add forms and edge cases without helping anyone read or discuss.
- **Each surface is one view whose contents depend on permissions.** There is one readings list and one reading view for everyone. In a fuller app a person might teach one class and take another, and a single view per surface extends to that naturally.
- **Permissions are checked in one place.** Code asks `can(user, action)`, and permission decisions never check `user.role` directly; outside `can()`, the role is only displayed (badges) or counted. Today the function reads the user's role. A rule about a specific resource, such as "authors can edit their own posts", would add the resource as a third argument. Posting has no rule yet, because every signed-in user may post. If roles later belong to a membership (user × class × role, including TAs), only this function changes.
- **Replies are the optional enhancement in scope.** They turn a list of comments into conversations, which is the core of a discussion app.
- **Replies are one level deep.** An annotation and its replies are already one strand of a reading's discussion. Nested branches would split it further and need a tree UI that doesn't fit narrow screens. Supporting them later would take an optional `inReplyToId` field and one database column; most of the work would be in the UI and in deleting replies that have children.
- **Annotations keep their place.** Annotations are ordered by when they were posted, and a new reply does not move its annotation. Sorting by last activity is available instead.
- **Instructor posts are marked.** Students can tell guidance from peer discussion at a glance.
- **Your own posts carry a "You" badge.** In a long discussion, people look for what they wrote and for replies to it. The name stays, so you see yourself as others do. A badge, rather than another tint or border, still works on an instructor's own post, which already has the instructor tint. It is outlined where the instructor badge is filled, so the two differ in shape and wording, not only in color.
- **Sorting happens in the browser and is not saved.** The data is already loaded, so sorting is instant. If the choice should be saved later, a URL parameter (such as `?sort=-annotations`) survives refresh and can be shared.
- **The phone sort menu offers every order the column headers can,** in both directions, such as "Oldest" and "Title Z to A". Sorting by a column and then narrowing the window keeps the same order, and the menu shows it.

## Interface

- **New readings are written in a side panel, not in the table.** The list stays usable while the panel is open, so an instructor can sort and scroll existing readings while choosing a title. A form inside the table would break as soon as the table was re-sorted. On phones, the form is its own screen. The table follows its own column's width (a CSS container query), so it becomes cards whenever the panel makes it narrow, not only on phones.
- **The reading view has two columns on wide screens.** The reading's title, description and counts stay in view on the left while the discussion scrolls on the right. On phones they stack, and the description collapses.
- **Replies open in place.** Opening an annotation's replies expands them beneath it. The same layout works at every screen size, and several annotations can be open at once.
- **Instructors can show all replies at once.** Reviewing a reading's discussion is an instructor's main task, so one click opens every annotation that has replies, loaded with one request. Annotations without replies stay closed, since opening them would only add empty reply boxes. Students don't see the button, which keeps their view simpler; it is a rule in `can()`, so giving it to everyone is a one-line change. The server doesn't check it, because every reply is readable anyway.
- **Composers are multi-line with an explicit Post button.** Enter adds a line, and Ctrl+Enter (or Cmd+Enter) posts. The annotation box sits above the annotations, where new ones appear; the reply box sits after an open annotation's newest reply. Unsent text is kept as a draft in memory, so leaving a page and coming back (for example, to sign in again) keeps it; a full reload clears it.
- **Problems with live updates are app status.** A dropped or stopped stream is reported in the status area, below lost connections and ended sign-ins. While connected, the discussion shows a quiet "Live updates on", as plain text rather than a dot, which next to a name usually means a person is online.
- **New annotations don't move what you're reading.** If you're scrolled down, a "1 new annotation" button counts other people's new annotations and scrolls up when clicked. Chrome, Edge and Firefox also keep the page still as annotations are added above, using scroll anchoring. Safari doesn't support scroll anchoring yet (as of Safari 26), so there the page shifts down by the new annotation's height.
- **Feedback stays proportionate.** A new post appearing is its own confirmation, and a new reading is placed first in the list with a short line confirming it. An error caused by an action appears next to that action. Problems with no triggering action share one status area that shows the most important one, so several failures never stack up.
- **A lost connection is shown only in the status area,** whichever request discovers it, and it clears as soon as any request gets an answer. Pages and actions don't repeat it, so there's one message and one Retry button. The API client reports the connection after every request, which keeps the rule in one place.
- **The app never leaves a page on its own.** When a request finds the sign-in has ended (a 401, for example after signing out in another tab), the status area says so and offers Sign in. The page, and anything typed on it, stays until the user chooses. A refused permission (a 403) is an ordinary error for the action that caused it.
- **Light and dark themes.** The app follows the system setting. Every color is a CSS custom property, so a theme is one set of values. There is no manual switch: the system setting is a sound default, and it keeps a rarely used control out of the interface.
- **Reading titles use a serif font.** The material reads differently from the discussion around it.

## Accessibility

- **Moving to another page moves focus to its heading** and gives the browser tab the page's name, such as "Supervised vs. unsupervised learning · Collab read". In a single-page app nothing else tells a screen reader that the page changed. Opening the new-reading panel only changes the query, so it keeps focus in the form.
- **Focus never disappears with its control.** When the new-reading panel closes, by Cancel, Create or the back button, focus returns to "New reading". The "new annotations" button focuses the newest annotation as it goes. A form with errors focuses the first field that has one, so its error is read.
- **Bylines carry hidden commas,** so screen readers and copied text get "Sarah Kim, You, 2 hours ago" rather than the parts run together.
- **Reply toggles are named after the annotation's author** for screen readers, such as "Reply to Michael Reyes", starting with the visible text so voice control still finds them.
- **Text fields and menus have a darker border than cards.** A field's border is its only edge, so it needs 3:1 contrast; card borders and dividers are decorative.
- **Left as they are:** the annotation box is labelled for screen readers but shows only its placeholder, which suits a single box under the reading; exact times appear on hover only; and new annotations from others aren't announced, which would be noisy in a busy discussion.

## Counting

- **Annotations and replies are counted separately.** The annotation count is what the requirements ask for: the number of annotations on a reading. Replies are conversation about those annotations, so they are shown beside it, with the total as posts: "7 annotations · 15 replies · 22 posts". Sorting by "Most annotations" uses the annotation count, so it matches the number in its column.
- **"Students participating" counts students only.** It measures student engagement, which instructor posts would distort.
- **Each counting rule is one query over the `posts` view** (see Data model), so changing a rule is one edit.

## Input

- **Text is normalized rather than restricted to allowed characters.** Academic discussion needs accents, non-Latin scripts and symbols. Script injection is prevented by always displaying text as plain text, and database injection by parameterized queries. Normalizing and removing invisible or deceptive characters handles the remaining unwanted input.
- **Text fields have character limits:** 2,000 for posts and reading descriptions, 200 for reading titles. A character limit works the same in every language and is easy to show with a counter.
- **Characters are counted as Unicode code points everywhere.** The client, the server and the database's `CHECK` constraints then agree, including on emoji.
- **Size assumptions are documented, not enforced.** Up to 100 annotations per reading and 30 replies per annotation. They justify loading a reading's annotations, and an annotation's replies, in full. Refusing a 31st reply would be a strange experience.

## API

- **The API is resource-oriented HTTP and JSON.** It follows Google's API Improvement Proposals (AIP) where they don't depend on gRPC, and common HTTP standards elsewhere.
- **Resources:** `users`, `readings`, `readings/{id}/annotations` and `readings/{id}/annotations/{id}/replies`, under `/v1`. Replies sit under their annotation because each belongs to exactly one. `readings/{id}/annotations/-/replies` lists the replies of every annotation on a reading, using AIP-159's `-` for "any annotation".
- **Methods are List and Get, plus Create for readings, annotations and replies.** Every create returns a `Location` header naming the new resource, and a Get serves it, so a client can find a post again from its address alone. Update and Delete can be added later without breaking clients.
- **Replies load when an annotation is opened,** or all at once when an instructor shows all replies. The annotation list includes each annotation's `replyCount` and `lastActivityAt`, which keeps the first load small.
- **Counts are read-only fields on the reading,** computed by the server, so the readings list needs one call. The participation count is left out of responses for users who may not view it, so the server enforces the rule rather than the UI hiding it.
- **List methods are paginated from the start** (`pageSize`, `pageToken`, `nextPageToken`; 50 items by default, at most 100). Adding pagination later would break clients. The client follows page tokens until none is left. The token encodes a position, which is simple and safe here: annotations are newest first and never deleted, so an annotation posted mid-load can only cause a repeated item, which the client discards.
- **Errors use RFC 9457 Problem Details** (`application/problem+json`). An `errors` list carries field-level problems for the UI to show next to each field.
- **The stored format and the API format are separate.** A small mapping function per resource turns database rows into API objects and keeps internal columns private, so storage can change without changing the API.
- **Identity travels in a cookie set by the server.** `POST /v1/session` signs in, `GET /v1/session` says who is signed in, and `DELETE /v1/session` signs out. A cookie is the one mechanism that works for both normal requests and the event stream, since `EventSource` cannot send custom headers.

## Real-time updates

How it works end to end is in [realtime.md](realtime.md).

- **Live updates use Server-Sent Events (SSE).** SSE is built into the browser, reconnects on its own, and sends data from server to client, which is all that is needed because writes go through the API. Polling adds delay, and WebSockets add two-way machinery the app doesn't use.
- **There is one stream per reading,** at `GET /v1/readings/{id}/events`. It carries every new annotation and reply for that reading, whether or not an annotation is open, so the annotation list and reply counts stay current.
- **The stream starts with a `ready` event, sent once the server is listening.** Every `ready`, first or after a reconnect, makes the client re-read the reading and its annotations, so nothing posted before it was listening is missed. The browser's own `open` event can't promise that, because it fires before the server has subscribed.
- **Each post is counted once, by ID.** A post can arrive twice, for example your own post in its create response and again from the stream; the second copy changes nothing.
- **Counts update at once, then the server's replace them.** A new post raises its annotation's and reading's counts locally, and a re-read from the server about 300 ms later replaces them. A re-read is applied only if nothing changed after it started, and only if no later re-read has been applied, so an older response can't undo a newer post. If it fails, the local counts stay.
- **Re-reading replaces replaying missed events,** which would need a stored event log. Loaded replies are reloaded at the same time, with one request for the whole reading.
- **Only new posts are published.** A retried create with the same `Idempotency-Key` publishes nothing.
- **A heartbeat event every 15 seconds** keeps proxies from closing a quiet stream, and lets the client notice a dead one. The browser can't always tell that a connection has died, so after 30 seconds without any event the client replaces the stream. The heartbeat is a named event because `EventSource` never passes comments to the page.
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
- **A `posts` view combines annotations and replies,** each row tagged as an annotation or a reply. A view holds no data, so it is rebuilt at every start and an existing database always gets the current definition.
- **IDs are integers in the database and strings in the API.** Integers are easy to work with while debugging, and switching to opaque IDs later wouldn't change the API.
- **Timestamps are set by the server** as ISO 8601 UTC text with milliseconds, for example `2026-10-24T15:04:05.123Z`. They are readable and sort correctly as text. Ties are broken by ID.
- **Idempotency keys are unique per user,** so one user's keys can't collide with another's. Sending a key is optional in the API.

## Database

- **SQLite, behind a small data layer.** It needs no setup, so a fresh clone runs. The data is relational: users, readings, annotations and replies, with counts and distinct participants.
- **Each index serves a known query:** the readings list, a reading's annotations, an annotation's replies, and idempotency-key lookups. Listing all of a reading's replies uses the same two indexes and sorts the result, which stays small under the size assumptions.
- **Foreign keys are enforced.** SQLite itself leaves them off by default. Node's driver turns them on, and the code requests it explicitly.
- **Tables are `STRICT`.** By default SQLite stores any value in any column; strict tables enforce the declared types.
- **The schema is created at startup, and a new database is seeded with sample data.** A fresh clone runs with no extra setup, and `npm run db:reset` starts over. A real deployment would use versioned migrations.
- **Changing databases would mean rewriting the data layer, not the app.** A document store, for example, would replace joins with lookups and distinct counts with aggregations or stored counters, behind the same functions.
- **Some future data suits other stores.** Reading content (PDFs, video) belongs in object storage. Reading metadata that varies by type, and annotation anchors (a text range, a video timestamp, an image region), are document-shaped. A JSON column would also work.

## Stack and tooling

- **Node 26, pinned.** It is the newest even-numbered release, which becomes long-term support in October 2026. `.nvmrc`, `engines` and `engine-strict` make `npm install` stop with a clear message on an older version.
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
- **After an outage, the page waits for Retry,** which reloads it, rather than noticing by itself that the server is back. Drafts are kept in memory, so the reload clears them. In development, restarting `npm run dev` also reloads the page (Vite's development client does this), with the same effect. Recovering in place, without a reload, would fix both.
- **Rare case:** if the connection drops after a new reading or post is saved but before the page hears back, sending an edited version creates a second one. Sending the same text again creates nothing new.
