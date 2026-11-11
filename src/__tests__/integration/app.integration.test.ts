import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';
import type express from 'express';
import { createApp } from '../../app';
import { InMemoryReportCache } from '../../cache/InMemoryReportCache';
import { loadConfig } from '../../config';
import { createDatabase, migrateDatabase } from '../../db/database';
import { OpenAiClient } from '../../llm/OpenAiClient';
import { YahooNewsProvider } from '../../news/YahooNewsProvider';
import type { ReportResponse } from '../../services/ReportResponse';
import { ReportService } from '../../services/ReportService';

// Full run with the real Yahoo and OpenAI APIs and an in-memory database.
describe.skipIf(!process.env.OPENAI_API_KEY)('app (real APIs)', () => {
  let db: Knex;
  let app: express.Express;

  beforeAll(async () => {
    const config = loadConfig({ ...process.env, DATABASE_PATH: ':memory:' });
    db = createDatabase(':memory:');
    await migrateDatabase(db);
    const reportService = new ReportService({
      db,
      news: new YahooNewsProvider(config.newsLimit),
      llm: new OpenAiClient(config.openaiApiKey),
      cache: new InMemoryReportCache(config.cacheTtlMinutes),
      config,
    });
    app = createApp(reportService);
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('returns a report for AAPL', async () => {
    const res = await request(app).get('/stocks/AAPL/report');

    expect(res.status).toBe(200);
    const body = res.body as ReportResponse;
    expect(body.ticker).toBe('AAPL');
    expect(body.summary.length).toBeGreaterThan(0);
    expect(body.sources.length).toBeGreaterThan(0);
    for (const keyPoint of body.keyPoints) {
      for (const index of keyPoint.sources) {
        expect(body.sources.map((s) => s.index)).toContain(index);
      }
    }
  });
});
