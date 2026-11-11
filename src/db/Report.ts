// One row per report run, including key points left out of the API response.
// ReportService writes it with insertReport(). toReportResponse reads the Report.

import type { Knex } from 'knex';
import type { Article } from '../news/NewsProvider';
import type { KeyPoint, SummaryVerdict, Verification } from '../services/schemas';

// The row as the app uses it. The JSON fields are already arrays here, the table stores them as text.
export interface Report {
  id: string;
  ticker: string;
  createdAt: Date;
  requestedModel: string;
  responseModel: string | null;
  // requestedModel, reasoning and inputTokens/outputTokens below are the generator's.
  // The verifier's values have the verifier prefix.
  reasoning: string;
  verifierModel: string | null;
  verifierReasoning: string | null;
  verification: Verification[] | null;
  summaryVerdict: SummaryVerdict | null;
  // What happened to the verification step. Set once when the run ends, see ReportMeta.
  verifierStatus: 'checked' | 'disabled' | 'no_news' | 'failed';
  // Message of the error when the verifier failed, otherwise null.
  verifierError: string | null;
  articles: Article[];
  newsProvider: string;
  newsFetchedAt: string;
  summary: string | null;
  keyPoints: KeyPoint[] | null;
  inputTokens: number;
  outputTokens: number;
  verifierInputTokens: number;
  verifierOutputTokens: number;
  durationMs: number;
}

// Inserts the report. The three JSON fields are written as text.
export async function insertReport(db: Knex, report: Report): Promise<void> {
  await db('report').insert({
    ...report,
    articles: JSON.stringify(report.articles),
    keyPoints: report.keyPoints === null ? null : JSON.stringify(report.keyPoints),
    verification: report.verification === null ? null : JSON.stringify(report.verification),
  });
}
