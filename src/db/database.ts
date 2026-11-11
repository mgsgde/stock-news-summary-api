// Opens the SQLite database with Knex and runs the migrations.
// index.ts and the tests call createDatabase() and then migrateDatabase().

import knex from 'knex';
import type { Knex } from 'knex';
import { extname, join } from 'path';

export function createDatabase(filename: string): Knex {
  return knex({
    client: 'sqlite3',
    connection: { filename },
    useNullAsDefault: true,
    // SQLite has one writer, and with ':memory:' every new connection would be a new empty database.
    pool: { min: 1, max: 1 },
  });
}

// Applies all migrations that have not run yet. The folder is src/migrations under tsx and Vitest
// and dist/migrations in the build, so the file extension follows this file (.ts or .js).
export async function migrateDatabase(db: Knex): Promise<void> {
  await db.migrate.latest({
    directory: join(__dirname, '..', 'migrations'),
    loadExtensions: [extname(__filename)],
  });
}
