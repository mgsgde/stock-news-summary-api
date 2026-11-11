import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Knex } from 'knex';
import type express from 'express';
import { createApp } from '../app';
import { InMemoryReportCache } from '../cache/InMemoryReportCache';
import { createDatabase, migrateDatabase } from '../db/database';
import { HttpError } from '../errors';
import { ReportService } from '../services/ReportService';
import { DISCLAIMER } from '../services/ReportResponse';
import type { ReportResponse } from '../services/ReportResponse';
import { FakeLlmClient } from './fakes/FakeLlmClient';
import { FakeNewsProvider } from './fakes/FakeNewsProvider';
import { enqueueRun, makeArticles, makeConfig } from './helpers';

let db: Knex;
let news: FakeNewsProvider;
let llm: FakeLlmClient;
let app: express.Express;

beforeEach(async () => {
  // The test articles are from 2024-11-07, so "now" must be close to that date or they count as old.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2024-11-08T12:00:00.000Z'));
  db = createDatabase(':memory:');
  await migrateDatabase(db);
  news = new FakeNewsProvider();
  news.articles = makeArticles(3);
  llm = new FakeLlmClient();
  const reportService = new ReportService({
    db,
    news,
    llm,
    cache: new InMemoryReportCache(30),
    config: makeConfig(),
  });
  app = createApp(reportService);
});

afterEach(async () => {
  vi.useRealTimers();
  await db.destroy();
});

describe('GET /stocks/{ticker}/report', () => {
  it('returns the report with sources and meta, without credentials', async () => {
    enqueueRun(llm, ['supported', 'unsupported', 'supported']);

    const res = await request(app).get('/stocks/aapl/report');

    expect(res.status).toBe(200);
    const body = res.body as ReportResponse;
    expect(body.ticker).toBe('AAPL');
    expect(body.disclaimer).toBe(DISCLAIMER);
    expect(typeof body.id).toBe('string');
    expect(body.summary).toBe('A short summary.');
    expect(body.keyPoints).toEqual([
      { index: 0, text: 'Point A', sources: [0], verification: 'supported' },
      { index: 2, text: 'Point C', sources: [2], verification: 'supported' },
    ]);
    // only the articles that the returned key points cite
    expect(body.sources.map((s) => s.index)).toEqual([0, 2]);
    expect(body.sources[0]).toMatchObject({
      index: 0,
      title: 'Headline 0',
      publisher: 'Publisher 0',
    });
    expect(body.meta).toMatchObject({
      cached: false,
      newsProvider: 'fake',
      verifierStatus: 'checked',
      generator: { model: 'gpt-5-mini', reasoning: 'low' },
      verifier: {
        model: 'gpt-5',
        reasoning: 'medium',
        checked: 3,
        removed: 1,
        summaryReplaced: false,
      },
    });
  });

  it('returns 400 for a bad ticker', async () => {
    const res = await request(app).get('/stocks/THISTICKERISWAYTOOLONG/report');
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed URL escape, not 500', async () => {
    const res = await request(app).get('/stocks/%E0/report');
    expect(res.status).toBe(400);
    expect(typeof (res.body as { message: string }).message).toBe('string');
  });

  it('returns 404 for an unknown ticker', async () => {
    news.known = false;
    const res = await request(app).get('/stocks/ZZZZ/report');
    expect(res.status).toBe(404);
  });

  it('returns 502 when the news provider fails', async () => {
    news.error = new HttpError(502, 'Yahoo is down');
    const res = await request(app).get('/stocks/AAPL/report');
    expect(res.status).toBe(502);
  });

  it('returns 502 when the generator keeps returning invalid output', async () => {
    llm.enqueue({ nope: true });
    llm.enqueue({ nope: true });
    const res = await request(app).get('/stocks/AAPL/report');
    expect(res.status).toBe(502);
  });
});

describe('misc', () => {
  it('serves the raw OpenAPI spec', async () => {
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect((res.body as { openapi: string }).openapi.startsWith('3.')).toBe(true);
  });

  it('redirects / to /docs', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/docs');
  });
});
