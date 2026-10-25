import { rmSync } from 'node:fs';
import { defaultDatabasePath, openDatabase } from './database.ts';
import { seed } from './seed.ts';

rmSync(defaultDatabasePath, { force: true });
const db = openDatabase(defaultDatabasePath);
seed(db);
db.close();
console.log(`Reset ${defaultDatabasePath} with sample data.`);
