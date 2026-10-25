# Requirements

A small collaborative reading app. Instructors assign readings, and students and instructors discuss each reading through annotations and replies.

A reading is a title and a description. An annotation is a comment on a whole reading, not on a passage of it.

Each requirement is tagged:

- **Core**: required for the app to do its job.
- **Chosen**: a deliberate choice; the reasons are in [decisions.md](decisions.md).

## Assumptions

- There is one implicit class, with no courses or enrollment.
- Users are seeded, and signing in means picking one of them. There is no real authentication.
- A reading has at most 100 annotations, and an annotation at most 30 replies. These limits are assumed, not enforced.
- An annotation or reply is at most 2,000 characters. A reading's title is at most 200 characters and its description at most 2,000. These limits are enforced.

## Functional requirements

### Identity and app shell

- **R1** (Core): A picker lists the seeded users with their names and roles. Choosing one enters the app.
- **R2** (Chosen): The chosen identity survives a page refresh. A header on every view shows the current user and offers "Switch user".
- **R3** (Chosen): The server checks permissions on every request. For example, a student cannot create a reading, even by calling the API directly.

### Readings list

- **R4** (Core): Lists every reading with its title, a short description, its annotation count, when it was created and when it last had activity.
- **R5** (Core): Instructors also see how many students have participated in each reading.
- **R6** (Core): Instructors add a reading in a panel beside the list, which stays sortable and scrollable while the panel is open. On phones the form is its own screen. Title and description are required. Errors appear next to the field, and success is confirmed.
- **R7** (Chosen): Each reading has its own URL, so links and the back button work.
- **R8** (Core): When there are no readings, instructors see a prompt to create one and students see that nothing is assigned yet.
- **R9** (Chosen): Readings are listed newest first, and columns can be sorted.

### Reading view

- **R10** (Core): Shows the reading's title, description and annotation count, and its discussion. Instructors also see how many students have participated.
- **R11** (Core): Students and instructors can post an annotation. The text box is multi-line, with a Post button and a Ctrl+Enter (or Cmd+Enter) shortcut.
- **R12** (Chosen): Students and instructors can reply to an annotation. Replies are one level deep.
- **R13** (Core): Annotations are listed newest first by when they were posted. A new reply does not move its annotation. Annotations can also be sorted by last activity.
- **R14** (Chosen): Each annotation shows its reply count. Opening it shows its replies, oldest first. Instructors can show every reply on the reading at once.
- **R15** (Core): Each annotation and reply shows its author and when it was posted, as a relative time with the exact time on hover.
- **R16** (Chosen): Instructor posts are marked visually.
- **R17** (Core): New annotations and replies appear without a page refresh, for the author and for everyone else viewing the reading. This includes new annotations arriving while replies are open. The view shows whether live updates are connected.
- **R18** (Core): Empty posts are rejected. A failed post keeps its draft and offers a retry.
- **R19** (Core): The view handles every state gracefully: no annotations yet, loading, server unreachable, and a reading that does not exist.
- **R20** (Chosen): An error caused by an action appears next to that action. Other problems appear in one status area, one at a time, so errors never pile up.

### Counting

- **R21** (Chosen): A reading's annotation count is the number of its annotations, from students and instructors. Replies are counted separately, and the UI shows both with their total, for example "7 annotations · 15 replies · 22 posts".
- **R22** (Chosen): "Students participating" counts the distinct students who posted an annotation or a reply.

### Input

- **R23** (Chosen): Posts are plain text. Before saving, the server:
  - normalizes Unicode,
  - removes control characters other than newlines and tabs,
  - removes bidirectional override characters,
  - trims whitespace and collapses long runs of blank lines,
  - rejects text that is empty or contains only invisible characters,
  - rejects text over 2,000 characters.

  The client shows a character counter and runs the same checks for early feedback.

### Reliability

- **R24** (Chosen): Requests that fail from network errors, 5xx or 429 responses are retried up to 3 times, with growing delays. After the last attempt the UI shows an error with a Retry button.
- **R25** (Chosen): Retrying a create never makes a duplicate.
- **R26** (Chosen): Concurrent replies are all accepted, in the order the server receives them.

### Optional enhancements

- Replies: in scope (R12).
- Automated tests: in scope.
- Filter by student, search, participation dashboard, editing and deleting: not yet decided.

## Non-functional requirements

- **N1** A fresh clone runs with `npm install` and one start command. The Node version is pinned. There is no Docker and ideally no native build step.
- **N2** Seed data includes realistic readings and conversations, and a command resets the database.
- **N3** The server is the source of truth for validation. Errors have one consistent format, which the UI turns into helpful messages.
- **N4** Database access sits behind a small data layer.
- **N5** The code is easy to review: small files, request and response types shared by client and server, and simple code over clever code.
- **N6** Basic accessibility: labelled inputs, full keyboard use, visible focus, and sensible focus after posting.
- **N7** Times are stored in UTC and shown in the viewer's local time.
- **N8** Security within scope: parameterized queries, user text never rendered as HTML, and documentation stating that authentication is simulated.
- **N9** Counts come from indexed queries.
- **N10** The layout works down to about 360px wide. On narrow screens, tables become stacked cards, column sorting becomes a menu, and tap targets are at least 44px.
- **N11** Light and dark themes: the app follows the system setting and offers a manual switch.

## Not in scope

Production authentication and security, deployment, CI/CD, large-scale data, rendering documents, and annotations anchored to passages.
