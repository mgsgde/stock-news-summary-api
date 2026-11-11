import type { LlmClient, LlmRequest, LlmResponse } from '../../llm/LlmClient';

// Every fake answer reports these token counts, so tests can calculate what a run cost.
export const FAKE_INPUT_TOKENS = 100;
export const FAKE_OUTPUT_TOKENS = 50;

type Canned = { output: unknown } | { error: Error };

// Returns canned responses in order and records every request.
export class FakeLlmClient implements LlmClient {
  calls: LlmRequest[] = [];
  private queue: Canned[] = [];

  // Makes every call take this long (for the test with concurrent requests)
  delayMs = 0;

  enqueue(output: unknown): void {
    this.queue.push({ output });
  }

  enqueueError(error: Error): void {
    this.queue.push({ error });
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    this.calls.push(request);
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    const next = this.queue.shift();
    if (!next) {
      throw new Error('FakeLlmClient: no canned response left');
    }
    if ('error' in next) {
      throw next.error;
    }
    return {
      output: next.output,
      responseModel: `${request.model}-fake`,
      inputTokens: FAKE_INPUT_TOKENS,
      outputTokens: FAKE_OUTPUT_TOKENS,
    };
  }
}
