import { afterEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';
import { createDatabase, migrateDatabase } from '../db/database';
import { insertReport } from '../db/Report';
import type { Report } from '../db/Report';
import { makeArticles } from './helpers';
import type { ReportRow } from './helpers';

let db: Knex | undefined;

afterEach(async () => {
  await db?.destroy();
  db = undefined;
});

async function tableNames(database: Knex): Promise<string[]> {
  const rows = await database<{ name: string }>('sqlite_master')
    .select('name')
    .where('type', 'table');
  return rows.map((row) => row.name);
}

// The raw row, so the test sees the JSON fields as text.
async function readRow(database: Knex, id: string): Promise<ReportRow> {
  const row = await database<ReportRow>('report').where({ id }).first();
  if (!row) {
    throw new Error(`Row ${id} not found`);
  }
  return row;
}

function makeReport(): Report {
  return {
    id: 'report-1',
    createdAt: new Date('2024-11-08T12:00:00.000Z'),
    ticker: 'AAPL',
    requestedModel: 'gpt-5',
    responseModel: null,
    reasoning: 'low',
    verifierModel: null,
    verifierReasoning: null,
    verification: [{ keyPointIndex: 0, verdict: 'supported', note: 'ok' }],
    summaryVerdict: null,
    verifierStatus: 'checked',
    verifierError: null,
    articles: makeArticles(2),
    newsProvider: 'fake',
    newsFetchedAt: '2024-11-08T12:00:00.000Z',
    summary: 'A short summary.',
    keyPoints: [{ text: 'Point A', sourceIndexes: [0] }],
    inputTokens: 1,
    outputTokens: 2,
    verifierInputTokens: 3,
    verifierOutputTokens: 4,
    durationMs: 5,
  };
}

describe('migrations', () => {
  it('create the report table on an in-memory database', async () => {
    db = createDatabase(':memory:');
    await migrateDatabase(db);

    expect(await tableNames(db)).toContain('report');
  });

  it('create the summaryVerdict column', async () => {
    db = createDatabase(':memory:');
    await migrateDatabase(db);

    const rows = await db.raw<{ name: string }[]>('PRAGMA table_info("report")');
    expect(rows.map((row) => row.name)).toContain('summaryVerdict');
  });

  it('create the expected columns', async () => {
    db = createDatabase(':memory:');
    await migrateDatabase(db);

    const rows = await db.raw<{ name: string }[]>('PRAGMA table_info("report")');
    expect(rows.map((row) => row.name).sort()).toEqual(Object.keys(makeReport()).sort());
  });

  it('can be reverted', async () => {
    db = createDatabase(':memory:');
    await migrateDatabase(db);
    await db.migrate.down({
      directory: `${__dirname}/../migrations`,
      loadExtensions: ['.ts'],
    });

    expect(await tableNames(db)).not.toContain('report');
  });
});

describe('insertReport', () => {
  it('stores the JSON fields as text that parses back', async () => {
    db = createDatabase(':memory:');
    await migrateDatabase(db);
    const report = makeReport();

    await insertReport(db, report);

    const row = await readRow(db, report.id);
    expect(typeof row.articles).toBe('string');
    expect(JSON.parse(row.articles) as unknown).toEqual(report.articles);
    expect(JSON.parse(row.keyPoints ?? '') as unknown).toEqual(report.keyPoints);
    expect(JSON.parse(row.verification ?? '') as unknown).toEqual(report.verification);
  });

  it('stores empty JSON fields as NULL', async () => {
    db = createDatabase(':memory:');
    await migrateDatabase(db);

    await insertReport(db, { ...makeReport(), keyPoints: null, verification: null });

    const row = await readRow(db, 'report-1');
    expect(row.keyPoints).toBeNull();
    expect(row.verification).toBeNull();
  });
});
