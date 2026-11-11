// HTTP client for the OpenAI Responses API. Returns parsed JSON and the token counts.
// Generator and Verifier call it through LlmClient. A failed call throws 502.

import axios from 'axios';
import { HttpError } from '../errors';
import type { LlmClient, LlmRequest, LlmResponse } from './LlmClient';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

interface OpenAiResponse {
  model: string;
  output?: {
    type: string;
    content?: { type: string; text?: string }[];
  }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class OpenAiClient implements LlmClient {
  constructor(private readonly apiKey: string | undefined) {
    // A missing key fails here, when the client is built, not on the first user request.
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY must be set to use the OpenAI client');
    }
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    let data: OpenAiResponse;
    try {
      const response = await axios.post<OpenAiResponse>(
        OPENAI_RESPONSES_URL,
        {
          model: request.model,
          reasoning: { effort: request.reasoning },
          input: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: request.schemaName,
              schema: request.schema,
              strict: true,
            },
          },
        },
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          // Reasoning models often need more than a minute.
          timeout: 120000,
        },
      );
      data = response.data;
    } catch (error) {
      // Status and message only. The request headers hold the API key and must stay out of the log.
      const reason = axios.isAxiosError(error)
        ? `status ${error.response?.status ?? 'none'}: ${error.message}`
        : 'unknown error';
      throw new HttpError(502, `OpenAI request failed (${reason})`);
    }

    const message = data.output?.find((item) => item.type === 'message');
    const textItem = message?.content?.find((item) => item.type === 'output_text');
    if (!textItem?.text) {
      throw new HttpError(502, 'OpenAI response contained no output text');
    }

    let output: unknown;
    try {
      output = JSON.parse(textItem.text);
    } catch {
      throw new HttpError(502, 'OpenAI output was not valid JSON');
    }

    return {
      output,
      responseModel: data.model,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };
  }
}
