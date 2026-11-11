// GET /stocks/{ticker}/report. Checks the ticker shape, then calls ReportService.
// tsoa reads the decorators and generates the route and the OpenAPI text.

import { Controller, Example, Get, Path, Response, Route, Tags } from '@tsoa/runtime';
import { HttpError } from '../errors';
import type { ReportResponse } from '../services/ReportResponse';
import type { ReportService } from '../services/ReportService';

const TICKER_PATTERN = /^[A-Za-z0-9.\-^=]{1,15}$/;

// tsoa creates the controller itself, without constructor arguments.
// So createApp() hands the service over here once at startup.
let reportService: ReportService;

export function setReportService(service: ReportService): void {
  reportService = service;
}

@Route('stocks')
@Tags('Reports')
export class ReportController extends Controller {
  /**
   * Get the latest AI news report for a stock. A report contains a short summary, key points
   * with sources, and details about how it was made.
   *
   * The report is written by one model and every key point is then checked against the
   * news articles by a second, stronger model. Key points that are not supported by
   * the articles are removed from the response. If the check fails, the report is still
   * returned, unverified, with `meta.verifierStatus` set to `failed`. Results are cached
   * for a short time (see `meta.cached`).
   *
   * @param ticker Stock ticker symbol, for example AAPL, MSFT or TSLA (1 to 15 characters). US tickers work best, because news coverage for other markets is thin
   */
  @Get('{ticker}/report')
  @Response<{ message: string }>(400, 'Invalid ticker')
  @Response<{ message: string }>(404, 'Unknown ticker')
  @Response<{ message: string }>(502, 'News provider or generator failed')
  @Example<ReportResponse>({
    id: '3f6c1c52-8c0e-4a39-a5b4-0c2f6f2d9c11',
    ticker: 'AAPL',
    disclaimer:
      'AI-generated summary of news headlines. It can contain errors and is not investment advice.',
    summary: 'Apple is in the news for a new iPhone launch and a supplier update.',
    keyPoints: [
      { index: 0, text: 'Apple launched a new iPhone.', sources: [0], verification: 'supported' },
    ],
    sources: [
      {
        index: 0,
        title: 'Apple launches new iPhone',
        publisher: 'Reuters',
        url: 'https://example.com/a',
        publishedAt: '2026-11-09T17:20:00.000Z',
      },
    ],
    meta: {
      generatedAt: '2026-11-09T17:25:00.000Z',
      cached: false,
      newsProvider: 'yahoo',
      generator: {
        model: 'gpt-5-mini',
        responseModel: 'gpt-5-mini-2025-08-07',
        reasoning: 'low',
      },
      verifierStatus: 'checked',
      verifier: {
        model: 'gpt-5',
        reasoning: 'medium',
        checked: 1,
        removed: 0,
        summaryReplaced: false,
      },
    },
  })
  public async getReport(@Path() ticker: string): Promise<ReportResponse> {
    if (!TICKER_PATTERN.test(ticker)) {
      throw new HttpError(
        400,
        'Invalid ticker. Use 1 to 15 characters: letters, digits and . - ^ =',
      );
    }
    return reportService.getReport(ticker);
  }
}
