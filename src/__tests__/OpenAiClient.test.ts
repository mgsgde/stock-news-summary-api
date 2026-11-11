import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, describe, expect, it } from 'vitest';
import { HttpError } from '../errors';
import { OpenAiClient } from '../llm/OpenAiClient';

const URL = 'https://api.openai.com/v1/responses';
const mock = new MockAdapter(axios);

const request = {
  model: 'gpt-5-nano',
  reasoning: 'low',
  system: 'system text',
  user: 'user text',
  schemaName: 'test_schema',
  schema: { type: 'object' },
};

afterEach(() => {
  mock.reset();
});

describe('OpenAiClient', () => {
  it('needs an API key', () => {
    expect(() => new OpenAiClient(undefined)).toThrow(/OPENAI_API_KEY/);
  });

  it('parses the output text and maps usage', async () => {
    mock.onPost(URL).reply(200, {
      model: 'gpt-5-nano-2025-08-07',
      output: [
        { type: 'reasoning', summary: [] },
        { type: 'message', content: [{ type: 'output_text', text: '{"summary":"hi"}' }] },
      ],
      usage: { input_tokens: 120, output_tokens: 45 },
    });

    const result = await new OpenAiClient('test-key').complete(request);

    expect(result).toEqual({
      output: { summary: 'hi' },
      responseModel: 'gpt-5-nano-2025-08-07',
      inputTokens: 120,
      outputTokens: 45,
    });
  });

  it('sends model, reasoning, messages, schema and bearer key', async () => {
    mock.onPost(URL).reply(200, {
      model: 'm',
      output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }] }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    await new OpenAiClient('test-key').complete(request);

    const sent = mock.history.post[0];
    expect(sent.headers?.Authorization).toBe('Bearer test-key');
    expect(JSON.parse(sent.data as string)).toEqual({
      model: 'gpt-5-nano',
      reasoning: { effort: 'low' },
      input: [
        { role: 'system', content: 'system text' },
        { role: 'user', content: 'user text' },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'test_schema',
          schema: { type: 'object' },
          strict: true,
        },
      },
    });
  });

  it('throws HttpError on an HTTP error', async () => {
    mock.onPost(URL).reply(500, { error: 'boom' });

    await expect(new OpenAiClient('test-key').complete(request)).rejects.toBeInstanceOf(HttpError);
  });

  it('throws HttpError when there is no output text', async () => {
    mock.onPost(URL).reply(200, { model: 'm', output: [] });

    await expect(new OpenAiClient('test-key').complete(request)).rejects.toBeInstanceOf(HttpError);
  });

  it('throws HttpError when the text is not JSON', async () => {
    mock.onPost(URL).reply(200, {
      model: 'm',
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'not json' }] }],
    });

    await expect(new OpenAiClient('test-key').complete(request)).rejects.toBeInstanceOf(HttpError);
  });
});
