import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { defaultDatabasePath, openDatabase } from './db/database.ts';
import { seed } from './db/seed.ts';

const isNewDatabase = !existsSync(defaultDatabasePath);
const db = openDatabase(defaultDatabasePath);
if (isNewDatabase) seed(db);

// API_PORT rather than PORT, which dev tools often set for the web page's own server.
// vite.config.ts forwards /v1 to this port.
const port = Number(process.env.API_PORT ?? 3000);

serve({ fetch: createApp(db).fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
