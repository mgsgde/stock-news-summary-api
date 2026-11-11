// Owns one report request: cache, then a new run if nobody is already running the same one.
// ReportController calls getReport().

import type { Knex } from 'knex';
import { randomUUID } from 'crypto';
import type { ReportCache } from '../cache/ReportCache';
import type { Config } from '../config';
import { insertReport } from '../db/Report';
import type { Report } from '../db/Report';
import { HttpError } from '../errors';
import type { LlmClient } from '../llm/LlmClient';
import { normaliseTicker } from '../news/NewsProvider';
import type { NewsProvider } from '../news/NewsProvider';
import { Generator } from './Generator';
import { toReportResponse } from './ReportResponse';
import type { ReportResponse } from './ReportResponse';
import { Verifier } from './Verifier';
import type { VerificationResult } from './Verifier';

export interface ReportServiceDeps {
  db: Knex;
  news: NewsProvider;
  llm: LlmClient;
  cache: ReportCache;
  config: Config;
}

// What one run produced. Every other Report field gets its empty value in saveReport().
type RunResult = Pick<
  Report,
  'articles' | 'newsFetchedAt' | 'summary' | 'keyPoints' | 'verifierStatus'
> &
  Partial<Report>;

export class ReportService {
  private readonly generator: Generator;
  private readonly verifier: Verifier;
  // Runs in progress, by ticker. A second request for the same ticker waits for the first one
  // instead of paying for a second run.
  private readonly inFlight = new Map<string, Promise<ReportResponse>>();

  // Tests pass fake news and a fake LLM instead of Yahoo and OpenAI.
  constructor(private readonly deps: ReportServiceDeps) {
    this.generator = new Generator(
      deps.llm,
      deps.config.generatorModel,
      deps.config.generatorReasoning,
    );
    this.verifier = new Verifier(
      deps.llm,
      deps.config.verifierModel,
      deps.config.verifierReasoning,
    );
  }

  // Answers from the cache, or joins a run that is already going, or starts a new run.
  async getReport(rawTicker: string): Promise<ReportResponse> {
    // BRK.B and BRK-B are one stock, so they share one cache entry and one run.
    const ticker = normaliseTicker(rawTicker);
    const { cache } = this.deps;

    const cached = await cache.get(ticker);
    if (cached) {
      // The stored response was built with cached: false. A hit has to say it came from the cache.
      return { ...cached, meta: { ...cached.meta, cached: true } };
    }

    const running = this.inFlight.get(ticker);
    if (running) {
      return running;
    }

    const run = this.runReport(ticker);
    this.inFlight.set(ticker, run);
    try {
      const response = await run;
      // A failed run throws, so it is never cached. A report whose verifier failed is not cached
      // either, so the next request retries the verification.
      if (response.meta.verifierStatus !== 'failed') {
        await cache.set(ticker, response);
      }
      return response;
    } finally {
      // Only after `await cache.set`: deleting earlier would leave a gap where a second request
      // finds neither a cache entry nor a run in progress and starts a second paid run.
      // Done or failed: the next request for this ticker may start a new run.
      this.inFlight.delete(ticker);
    }
  }

  private async runReport(ticker: string): Promise<ReportResponse> {
    const { news, config } = this.deps;
    const startedAt = Date.now();

    // 1. Fetch news
    const newsResult = await news.fetchNews(ticker);
    const newsFetchedAt = new Date().toISOString();
    if (!newsResult.known) {
      throw new HttpError(404, `Unknown ticker ${ticker}`);
    }

    // Drop old articles here, not in the provider, so every news provider gets the same rule.
    // If none are left, the "no news" branch below answers.
    const oldestAllowed = Date.now() - config.newsMaxAgeDays * 24 * 60 * 60 * 1000;
    const articles = newsResult.articles.filter(
      (article) => new Date(article.publishedAt).getTime() >= oldestAllowed,
    );

    // 2. No news: store a short report and answer without calling the model
    if (articles.length === 0) {
      const report = await this.saveReport(ticker, startedAt, {
        articles,
        newsFetchedAt,
        summary: `The news provider returned no recent articles about ${ticker}.`,
        keyPoints: [],
        verifierStatus: 'no_news',
      });
      return toReportResponse(report);
    }

    // 3. Generator writes the summary and the key points
    const generated = await this.generator.generate(ticker, articles);

    // 4. Verifier checks them, if it is switched on. If it fails, the report is still returned,
    // without verification, because the generator already succeeded and was paid for.
    let verified: VerificationResult | null = null;
    let verifierError: string | null = null;
    if (config.verify) {
      try {
        verified = await this.verifier.verify(articles, generated.output);
      } catch (error) {
        verifierError = error instanceof Error ? error.message : 'Verifier failed';
        // Message only: the error object may carry the request config.
        console.warn(`Verifier failed for ${ticker}: ${verifierError}`);
      }
    }

    // 5. Store the report
    const run: RunResult = {
      articles,
      newsFetchedAt,
      summary: generated.output.summary,
      keyPoints: generated.output.keyPoints,
      responseModel: generated.responseModel,
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
      verifierStatus: !config.verify ? 'disabled' : verified ? 'checked' : 'failed',
      verifierError,
    };
    if (verified) {
      run.verifierModel = config.verifierModel;
      run.verifierReasoning = config.verifierReasoning;
      run.verification = verified.verification;
      run.summaryVerdict = verified.summaryVerdict;
      run.verifierInputTokens = verified.inputTokens;
      run.verifierOutputTokens = verified.outputTokens;
    }
    const report = await this.saveReport(ticker, startedAt, run);

    // 6. Build the API response from the stored report
    return toReportResponse(report);
  }

  // Inserts one report row. `run` holds what this run produced, everything else gets its empty value.
  private async saveReport(ticker: string, startedAt: number, run: RunResult): Promise<Report> {
    const { config, news } = this.deps;
    const report: Report = {
      id: randomUUID(),
      createdAt: new Date(),
      ticker,
      requestedModel: config.generatorModel,
      responseModel: null,
      reasoning: config.generatorReasoning,
      verifierModel: null,
      verifierReasoning: null,
      verification: null,
      summaryVerdict: null,
      verifierError: null,
      newsProvider: news.name,
      inputTokens: 0,
      outputTokens: 0,
      verifierInputTokens: 0,
      verifierOutputTokens: 0,
      durationMs: Date.now() - startedAt,
      ...run,
    };
    await insertReport(this.deps.db, report);
    return report;
  }
}
