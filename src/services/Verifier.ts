// Step 4 of a report run: a second model checks every key point against the articles.
// Called by ReportService.runReport(). It only sees the articles, the draft and its own prompt.

import { HttpError } from '../errors';
import type { LlmClient } from '../llm/LlmClient';
import type { Article } from '../news/NewsProvider';
import { formatArticles, sanitise, VERIFIER_PROMPT } from './prompts';
import { parseVerifierOutput, VERIFIER_JSON_SCHEMA } from './schemas';
import type { GeneratorOutput, SummaryVerdict, Verification } from './schemas';

export interface VerificationResult {
  verification: Verification[];
  summaryVerdict: SummaryVerdict;
  /** Summed over both attempts. */
  inputTokens: number;
  outputTokens: number;
}

export class Verifier {
  constructor(
    private readonly llm: LlmClient,
    private readonly model: string,
    private readonly reasoning: string,
  ) {}

  /** Judges each key point and the summary. Throws (a 502 HttpError) when both attempts fail the check. ReportService catches it and returns the report unverified. */
  async verify(articles: Article[], draft: GeneratorOutput): Promise<VerificationResult> {
    const keyPointLines = draft.keyPoints
      .map(
        (kp, index) =>
          `[${index}] ${sanitise(kp.text)} (cites articles: ${kp.sourceIndexes.join(', ')})`,
      )
      .join('\n');
    // The generator's text came from untrusted headlines, so it is sanitised and wrapped like them.
    const user =
      `Current time: ${new Date().toISOString()}\n\n` +
      `Articles (indexes start at 0):\n${formatArticles(articles)}\n\n` +
      `Report written by the other model:\n<report>\n` +
      `Key points (indexes start at 0):\n${keyPointLines}\n\n` +
      `Summary text:\n${sanitise(draft.summary)}\n` +
      '</report>\n\n' +
      'Also judge the summary text as a whole: supported only if every claim in it is backed by the articles.';
    let inputTokens = 0;
    let outputTokens = 0;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await this.llm.complete({
        model: this.model,
        reasoning: this.reasoning,
        system: VERIFIER_PROMPT,
        user,
        schemaName: 'verification',
        schema: VERIFIER_JSON_SCHEMA,
      });
      inputTokens += response.inputTokens;
      outputTokens += response.outputTokens;

      const output = parseVerifierOutput(response.output, draft.keyPoints.length);
      if (output) {
        // Stored in key-point order so verification[i] is the verdict for key point i.
        const verification = output.results.sort((a, b) => a.keyPointIndex - b.keyPointIndex);
        return { verification, summaryVerdict: output.summary.verdict, inputTokens, outputTokens };
      }
    }
    // ReportService catches this: a failed verifier does not fail the request.
    throw new HttpError(502, 'Verifier returned invalid output twice');
  }
}
