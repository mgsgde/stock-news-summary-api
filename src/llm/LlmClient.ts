// The model call shared by Generator and Verifier.
// OpenAiClient is the real client. Tests pass FakeLlmClient, which has the same complete() method.

export interface LlmRequest {
  model: string;
  reasoning: string;
  system: string;
  user: string;
  /** Name and JSON Schema of the structured output OpenAI must return. */
  schemaName: string;
  schema: object;
}

export interface LlmResponse {
  /** Parsed JSON. The caller checks the shape again. */
  output: unknown;
  /** Model id the provider reports. It can be more specific than the name we requested. */
  responseModel: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResponse>;
}
