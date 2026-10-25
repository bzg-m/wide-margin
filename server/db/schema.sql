-- Users are seeded; signing in means picking one.
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('student', 'instructor'))
) STRICT;

CREATE TABLE IF NOT EXISTS readings (
  id              INTEGER PRIMARY KEY,
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description     TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 2000),
  creator_id      INTEGER NOT NULL REFERENCES users (id),
  created_at      TEXT NOT NULL,
  idempotency_key TEXT,
  UNIQUE (creator_id, idempotency_key)
) STRICT;
CREATE INDEX IF NOT EXISTS readings_by_created ON readings (created_at, id);

-- An annotation starts a thread on a reading.
CREATE TABLE IF NOT EXISTS annotations (
  id              INTEGER PRIMARY KEY,
  reading_id      INTEGER NOT NULL REFERENCES readings (id),
  author_id       INTEGER NOT NULL REFERENCES users (id),
  text            TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
  created_at      TEXT NOT NULL,
  idempotency_key TEXT,
  UNIQUE (author_id, idempotency_key)
) STRICT;
CREATE INDEX IF NOT EXISTS annotations_by_reading ON annotations (reading_id, created_at, id);

-- A reply belongs to an annotation, so replies are one level deep
-- and always share their annotation's reading.
CREATE TABLE IF NOT EXISTS replies (
  id              INTEGER PRIMARY KEY,
  annotation_id   INTEGER NOT NULL REFERENCES annotations (id),
  author_id       INTEGER NOT NULL REFERENCES users (id),
  text            TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
  created_at      TEXT NOT NULL,
  idempotency_key TEXT,
  UNIQUE (author_id, idempotency_key)
) STRICT;
CREATE INDEX IF NOT EXISTS replies_by_annotation ON replies (annotation_id, created_at, id);

-- Every post on a reading, threads and replies alike. Counts are computed from this view.
CREATE VIEW IF NOT EXISTS posts AS
  SELECT reading_id, author_id, created_at, 'thread' AS kind FROM annotations
  UNION ALL
  SELECT a.reading_id, r.author_id, r.created_at, 'reply' AS kind
  FROM replies r JOIN annotations a ON a.id = r.annotation_id;
