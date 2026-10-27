# Collab read

A small collaborative reading app. Instructors post readings, and students and instructors
discuss each one through annotations and replies, which appear for everyone viewing the reading
without a page refresh.

Vue 3, Pinia and Vite on the client; Hono on Node with SQLite on the server; TypeScript
throughout, with request and response types and validation shared between the two.

## Run it

You need Node 26 or later (`.nvmrc` pins 26, and `npm install` refuses older versions). There is
no database server, Docker or native build step.

```bash
npm install
npm run dev
```

Open http://localhost:5173. Vite serves the page there and forwards API calls to the server on
port 3000 (set `API_PORT` to change it).

## Sample data and signing in

The first start creates `collab-read.db` with sample users, four readings and their discussions.
To start over, stop the app, run `npm run db:reset`, and start it again.

Signing in is simulated: pick anyone from the list. There are no passwords, and the sign-in cookie
holds an unsigned user ID, so this is not authentication. To see live updates, sign in as
Dr. Maya Lee (an instructor) in one window and Sarah Kim (a student) in a private window, and open
the same reading in both.

Things to try:

- As an instructor: create a reading, see how many students have participated, and use
  "Show all replies".
- Post and reply in one window and watch the other.
- Stop the server: the page says it can't reach it and keeps your draft while it's down. To stop
  only the API, run `npm run dev:server` and `npm run dev:client` in separate terminals instead of
  `npm run dev`.
- Narrow the window to phone width.

## Tests and checks

```bash
npm test -- --run      # all tests once (npm test alone watches for changes)
npm run check          # type check and lint
npx prettier --check . # formatting
```

## How it's organized

- `client/`: the Vue app. Pages in `views/`, components in `components/`, state in `stores/`, the
  API client in `api/`.
- `server/`: the Hono API. Routes in `routes/`, the data layer and schema in `db/`.
- `shared/`: types, validation schemas, text cleaning and permission rules used by both.
- `docs/`: [requirements](docs/requirements.md), [decisions](docs/decisions.md) with the reason
  for each, and [how live updates work](docs/realtime.md).

## The API

Resource-oriented JSON under `/v1`, following Google's API Improvement Proposals where they apply.
Errors use RFC 9457 Problem Details, lists are paginated, creates accept an `Idempotency-Key` so
retries never duplicate, and every create returns a `Location` that a Get serves. The website uses
nothing else, so any client can do what it does.

| Method and path                                          | What it does                                              |
| -------------------------------------------------------- | --------------------------------------------------------- |
| `GET /v1/users`                                          | List users (for the sign-in picker)                       |
| `POST`, `GET`, `DELETE /v1/session`                      | Sign in, see who is signed in, sign out                   |
| `GET`, `POST /v1/readings`                               | List readings with their counts, create one (instructors) |
| `GET /v1/readings/{id}`                                  | Get a reading                                             |
| `GET /v1/readings/{id}/events`                           | Live updates for a reading (Server-Sent Events)           |
| `GET`, `POST /v1/readings/{id}/annotations`              | List or post annotations                                  |
| `GET /v1/readings/{id}/annotations/{id}`                 | Get an annotation                                         |
| `GET`, `POST /v1/readings/{id}/annotations/{id}/replies` | List or post replies                                      |
| `GET /v1/readings/{id}/annotations/{id}/replies/{id}`    | Get a reply                                               |
| `GET /v1/readings/{id}/annotations/-/replies`            | List every reply on a reading                             |

## Scope

Sign-in is simulated, and editing, deleting, search and filtering aren't built yet.
[docs/decisions.md](docs/decisions.md) lists what's open and why.

## About AI assistance

I built this with an AI coding assistant (Claude Code) as a pair. Designs and code were proposed,
reviewed and approved before being written, and every change came with tests, type checks, lint,
a check that the tests fail when the rule they protect is broken, and a look in the browser. The
decisions and their reasons are in [docs/decisions.md](docs/decisions.md).
