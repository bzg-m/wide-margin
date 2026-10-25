import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { defaultDatabasePath, openDatabase } from './db/database.ts';
import { seed } from './db/seed.ts';

const isNewDatabase = !existsSync(defaultDatabasePath);
const db = openDatabase(defaultDatabasePath);
if (isNewDatabase) seed(db);

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
