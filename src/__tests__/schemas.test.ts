import { describe, expect, it } from 'vitest';
import {
  GENERATOR_JSON_SCHEMA,
  parseGeneratorOutput,
  parseVerifierOutput,
  VERIFIER_JSON_SCHEMA,
} from '../services/schemas';

describe('parseGeneratorOutput', () => {
  const valid = { summary: 's', keyPoints: [{ text: 't', sourceIndexes: [0, 2] }] };

  it('accepts valid output', () => {
    expect(parseGeneratorOutput(valid, 3)).toEqual(valid);
  });

  it('accepts no key points but not more than 6', () => {
    expect(parseGeneratorOutput({ summary: 's', keyPoints: [] }, 3)).toEqual({
      summary: 's',
      keyPoints: [],
    });
    const seven = Array.from({ length: 7 }, () => ({ text: 't', sourceIndexes: [0] }));
    expect(parseGeneratorOutput({ summary: 's', keyPoints: seven }, 3)).toBeNull();
  });

  it('rejects a source index outside the article range', () => {
    expect(parseGeneratorOutput(valid, 2)).toBeNull();
  });

  it('rejects a key point without sources', () => {
    expect(
      parseGeneratorOutput({ summary: 's', keyPoints: [{ text: 't', sourceIndexes: [] }] }, 3),
    ).toBeNull();
  });

  it('rejects wrong types', () => {
    expect(parseGeneratorOutput(null, 3)).toBeNull();
    expect(parseGeneratorOutput({ summary: 1, keyPoints: [] }, 3)).toBeNull();
  });

  it('rejects a blank summary or key point', () => {
    expect(
      parseGeneratorOutput({ summary: '   ', keyPoints: [{ text: 't', sourceIndexes: [0] }] }, 1),
    ).toBeNull();
    expect(
      parseGeneratorOutput({ summary: 's', keyPoints: [{ text: ' ', sourceIndexes: [0] }] }, 1),
    ).toBeNull();
  });
});

describe('parseVerifierOutput', () => {
  const summary = { verdict: 'supported', note: 'ok' };
  const valid = {
    summary,
    results: [
      { keyPointIndex: 0, verdict: 'supported', note: 'ok' },
      { keyPointIndex: 1, verdict: 'unsupported', note: 'no' },
    ],
  };

  it('accepts one verdict per key point', () => {
    expect(parseVerifierOutput(valid, 2)).toEqual(valid);
  });

  it('rejects a missing verdict', () => {
    expect(parseVerifierOutput(valid, 3)).toBeNull();
  });

  it('rejects a duplicate or unknown key point index', () => {
    const duplicate = { summary, results: [valid.results[0], valid.results[0]] };
    expect(parseVerifierOutput(duplicate, 2)).toBeNull();
    const unknown = { summary, results: [{ keyPointIndex: 5, verdict: 'supported', note: '' }] };
    expect(parseVerifierOutput(unknown, 1)).toBeNull();
  });

  it('rejects a missing or invalid summary verdict', () => {
    expect(parseVerifierOutput({ results: valid.results }, 2)).toBeNull();
    const bad = { ...valid, summary: { verdict: 'contradicted', note: '' } };
    expect(parseVerifierOutput(bad, 2)).toBeNull();
  });

  it('rejects an unknown verdict', () => {
    const bad = { summary, results: [{ keyPointIndex: 0, verdict: 'maybe', note: '' }] };
    expect(parseVerifierOutput(bad, 1)).toBeNull();
  });
});

describe('OpenAI JSON schemas', () => {
  // Descriptions and the largest integer are not what these tests are about.
  const anyText = expect.any(String) as string;
  const anyNumber = expect.any(Number) as number;

  // OpenAI wants every object strict: additionalProperties false and every property required.
  // toEqual also shows that there is no $schema key and no minLength (the blank check is zod only).
  it('has the expected strict shape for the generator', () => {
    expect(GENERATOR_JSON_SCHEMA).toEqual({
      type: 'object',
      properties: {
        summary: { type: 'string', description: anyText },
        keyPoints: {
          type: 'array',
          maxItems: 6,
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', description: anyText },
              sourceIndexes: {
                type: 'array',
                minItems: 1,
                items: { type: 'integer', minimum: 0, maximum: anyNumber },
                description: anyText,
              },
            },
            required: ['text', 'sourceIndexes'],
            additionalProperties: false,
          },
        },
      },
      required: ['summary', 'keyPoints'],
      additionalProperties: false,
    });
  });

  it('has the expected strict shape for the verifier', () => {
    expect(VERIFIER_JSON_SCHEMA).toEqual({
      type: 'object',
      properties: {
        summary: {
          type: 'object',
          properties: {
            verdict: { type: 'string', enum: ['supported', 'unsupported'] },
            note: { type: 'string', description: anyText },
          },
          required: ['verdict', 'note'],
          additionalProperties: false,
        },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              keyPointIndex: {
                type: 'integer',
                minimum: 0,
                maximum: anyNumber,
                description: anyText,
              },
              verdict: { type: 'string', enum: ['supported', 'unsupported', 'contradicted'] },
              note: { type: 'string', description: anyText },
            },
            required: ['keyPointIndex', 'verdict', 'note'],
            additionalProperties: false,
          },
        },
      },
      required: ['summary', 'results'],
      additionalProperties: false,
    });
  });
});
