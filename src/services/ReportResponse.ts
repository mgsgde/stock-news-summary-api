// Step 6 of a report run: builds the JSON body from the stored report.
// Called at the end of ReportService.runReport(). Unsupported key points stay out of the body.

import type { Report } from '../db/Report';

// Shown in every response, so a reader knows this is AI text and not advice.
export const DISCLAIMER =
  'AI-generated summary of news headlines. It can contain errors and is not investment advice.';

/** One key point of the report. */
export interface ReportKeyPoint {
  /**
   * Position of this key point in the stored report. It can have gaps, because removed key points are not returned.
   */
  index: number;
  /** One factual statement about the stock. */
  text: string;
  /** Indexes of the entries in `sources` that this key point is based on. */
  sources: number[];
  /**
   * `supported`: a second (verifier) model confirmed the key point against the articles.
   * `not_verified`: the verifier is switched off or failed, the key point is unchecked.
   */
  verification: 'supported' | 'not_verified';
}

/** One news article the report is based on. */
export interface ReportSource {
  /**
   * Position of this article among the fetched articles. Key points refer to this number.
   * It can have gaps, because only articles that a returned key point cites are listed.
   */
  index: number;
  /** Headline of the article. */
  title: string;
  /** Publisher name, for example Reuters. */
  publisher: string;
  /** Link to the article. */
  url: string;
  /** Publication time, ISO 8601. */
  publishedAt: string;
}

/** Details about the model that wrote the report. */
export interface GeneratorMeta {
  /** Model that was requested. */
  model: string;
  /** Model name reported by the provider. */
  responseModel: string | null;
  /** Reasoning effort that was used. */
  reasoning: string;
}

/** Details about the verification step. */
export interface VerifierMeta {
  /** Model that checked the key points. */
  model: string;
  /** Reasoning effort that was used. */
  reasoning: string;
  /** How many key points were checked. */
  checked: number;
  /** How many key points were removed because they were unsupported or contradicted. */
  removed: number;
  /**
   * True when the verifier found claims in the generated summary text that the articles do not
   * back. The `summary` is then a bullet list of the verified key points.
   */
  summaryReplaced: boolean;
}

export interface ReportMeta {
  /** When the report was generated, ISO 8601. Stays the same for cached answers. */
  generatedAt: string;
  /** True when this answer came from the cache. */
  cached: boolean;
  /** Name of the news provider. */
  newsProvider: string;
  generator: GeneratorMeta;
  /**
   * What happened to the verification step.
   * `checked`: the verifier ran and the key points were checked.
   * `disabled`: the verifier is switched off, nothing was checked.
   * `no_news`: there were no articles, so there was nothing to check.
   * `failed`: the verifier failed, so the key points are `not_verified`. The summary is the generator's text.
   */
  verifierStatus: Report['verifierStatus'];
  /** Null when the verifier did not run (see `verifierStatus`). */
  verifier: VerifierMeta | null;
}

/** AI news report for one stock. */
export interface ReportResponse {
  /** Id of the stored report. */
  id: string;
  /** Ticker in upper case. */
  ticker: string;
  /** Label for readers: the report is AI-generated, can be wrong and is not investment advice. */
  disclaimer: string;
  /**
   * Short markdown summary of the latest news. Checked by the verifier, unless `meta.verifierStatus` is not `checked`. If it was not backed by
   * the articles, it is replaced by a bullet list of the verified key points (`meta.verifier.summaryReplaced`).
   */
  summary: string;
  /** Key points that passed verification. Unsupported or contradicted points are removed. */
  keyPoints: ReportKeyPoint[];
  /**
   * The articles that the returned key points cite, each with its original `index`. Articles
   * that no returned key point cites are left out. Empty when there are no key points.
   */
  sources: ReportSource[];
  meta: ReportMeta;
}

/** Keeps supported key points, and replaces a summary the verifier rejected. */
export function toReportResponse(report: Report): ReportResponse {
  const storedKeyPoints = report.keyPoints ?? [];

  const keyPoints: ReportKeyPoint[] = [];
  for (let index = 0; index < storedKeyPoints.length; index++) {
    // verification[i] is the verdict for key point i. No verifier run means every key point stays.
    const verdict = report.verification != null ? report.verification[index].verdict : null;
    if (verdict !== null && verdict !== 'supported') {
      continue;
    }
    keyPoints.push({
      index,
      text: storedKeyPoints[index].text,
      sources: storedKeyPoints[index].sourceIndexes,
      verification: verdict === 'supported' ? 'supported' : 'not_verified',
    });
  }

  // The verifier rejected the summary text, so the body lists the key points that remain.
  const summaryReplaced = report.summaryVerdict === 'unsupported';
  let summary = report.summary ?? '';
  if (summaryReplaced) {
    summary =
      keyPoints.length > 0
        ? keyPoints.map((keyPoint) => `- ${keyPoint.text}`).join('\n')
        : 'No claim in the generated summary could be verified against the articles.';
  }

  // List only the articles that a returned key point cites. The DB row keeps all of them.
  const citedIndexes = new Set(keyPoints.flatMap((keyPoint) => keyPoint.sources));
  const sources: ReportSource[] = [];
  report.articles.forEach((article, index) => {
    if (citedIndexes.has(index)) {
      sources.push({ index, ...article });
    }
  });

  return {
    id: report.id,
    ticker: report.ticker,
    disclaimer: DISCLAIMER,
    summary,
    keyPoints,
    sources,
    meta: {
      // Time the row was stored. A later cache hit must show that age, not the time of the new request.
      generatedAt: report.createdAt.toISOString(),
      cached: false,
      newsProvider: report.newsProvider,
      generator: {
        model: report.requestedModel,
        responseModel: report.responseModel,
        reasoning: report.reasoning,
      },
      verifierStatus: report.verifierStatus,
      // Null when no verifier ran: see verifierStatus.
      verifier:
        report.verification != null
          ? {
              model: report.verifierModel ?? '',
              reasoning: report.verifierReasoning ?? '',
              checked: storedKeyPoints.length,
              removed: report.verification.filter((entry) => entry.verdict !== 'supported').length,
              summaryReplaced,
            }
          : null,
    },
  };
}
