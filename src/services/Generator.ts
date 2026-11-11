// Step 3 of a report run: one model writes the summary and the key points from the headlines.
// Called by ReportService.runReport(). A reply that fails the schema check is tried once more.

import { HttpError } from '../errors';
import type { LlmClient } from '../llm/LlmClient';
import type { Article } from '../news/NewsProvider';
import { formatArticles, GENERATOR_PROMPT } from './prompts';
import { GENERATOR_JSON_SCHEMA, parseGeneratorOutput } from './schemas';
import type { GeneratorOutput } from './schemas';

export interface GeneratorResult {
  output: GeneratorOutput;
  responseModel: string;
  /** Summed over both attempts. */
  inputTokens: number;
  outputTokens: number;
}

export class Generator {
  constructor(
    private readonly llm: LlmClient,
    private readonly model: string,
    private readonly reasoning: string,
  ) {}

  /** Asks the model for the summary and key points. Throws 502 when both attempts fail the check. */
  async generate(ticker: string, articles: Article[]): Promise<GeneratorResult> {
    const user = `Current time: ${new Date().toISOString()}\n\nTicker: ${ticker}\n\nArticles (indexes start at 0):\n${formatArticles(articles)}`;
    let inputTokens = 0;
    let outputTokens = 0;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await this.llm.complete({
        model: this.model,
        reasoning: this.reasoning,
        system: GENERATOR_PROMPT,
        user,
        schemaName: 'stock_summary',
        schema: GENERATOR_JSON_SCHEMA,
      });
      inputTokens += response.inputTokens;
      outputTokens += response.outputTokens;

      const output = parseGeneratorOutput(response.output, articles.length);
      if (output) {
        return { output, responseModel: response.responseModel, inputTokens, outputTokens };
      }
    }
    throw new HttpError(502, 'Generator returned invalid output twice');
  }
}
