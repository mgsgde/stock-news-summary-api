import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../config';
import { OpenAiClient } from '../../llm/OpenAiClient';
import { GENERATOR_JSON_SCHEMA, parseGeneratorOutput } from '../../services/schemas';

// Same model as the app: GENERATOR_MODEL, with the default from config.
const { generatorModel } = loadConfig(process.env);

// Calls the real OpenAI API. Skipped when OPENAI_API_KEY is not set.
describe.skipIf(!process.env.OPENAI_API_KEY)('OpenAI (real API)', () => {
  it('returns schema-valid generator output for two tiny articles', async () => {
    const client = new OpenAiClient(process.env.OPENAI_API_KEY);

    const result = await client.complete({
      model: generatorModel,
      reasoning: 'low',
      system:
        'You summarise news about one stock. Use only the numbered articles. ' +
        'Write a short summary and 2 key points. Every key point cites article indexes.',
      user:
        'Ticker: TEST\n\nArticles (indexes start at 0):\n' +
        '[0] Test Corp raises full-year outlook (Example News, 2024-11-07T10:00:00.000Z)\n' +
        '[1] Test Corp opens new factory in Ohio (Example News, 2024-11-06T09:00:00.000Z)',
      schemaName: 'stock_summary',
      schema: GENERATOR_JSON_SCHEMA,
    });

    expect(parseGeneratorOutput(result.output, 2)).not.toBeNull();
    expect(result.inputTokens).toBeGreaterThan(0);
    expect(result.outputTokens).toBeGreaterThan(0);
    expect(result.responseModel).toContain(generatorModel);
  });
});
