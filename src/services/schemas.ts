// One zod schema (a shape checker) per model answer. The same schema is sent to OpenAI
// and used again to check the reply.

import { z } from 'zod';

// OpenAI rejects the draft URL zod puts in `$schema`. Bounds such as minItems are sent as-is.
function toOpenAiSchema(schema: z.ZodType): object {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}

const keyPointSchema = z.strictObject({
  text: z
    .string()
    // Checked here only, not sent to OpenAI.
    .refine((s) => s.trim() !== '', 'must not be blank')
    .describe('One factual statement'),
  sourceIndexes: z
    .array(z.number().int().min(0))
    .min(1)
    .describe('Zero-based indexes of the articles this key point is based on'),
});

export const GeneratorOutputSchema = z.strictObject({
  summary: z
    .string()
    // Checked here only, not sent to OpenAI.
    .refine((s) => s.trim() !== '', 'must not be blank')
    .describe('Markdown summary of the news, at most 150 words'),
  // 0 is allowed: the prompt says to report little relevant news when the articles are off-topic.
  keyPoints: z.array(keyPointSchema).max(6),
});

export type GeneratorOutput = z.infer<typeof GeneratorOutputSchema>;
export type KeyPoint = GeneratorOutput['keyPoints'][number];

export const GENERATOR_JSON_SCHEMA = toOpenAiSchema(GeneratorOutputSchema);

const verifierResultSchema = z.strictObject({
  keyPointIndex: z.number().int().min(0).describe('Zero-based index of the key point'),
  verdict: z.enum(['supported', 'unsupported', 'contradicted']),
  note: z.string().describe('One sentence explaining the verdict'),
});

export const VerifierOutputSchema = z.strictObject({
  summary: z.strictObject({
    verdict: z.enum(['supported', 'unsupported']),
    note: z.string().describe('One sentence explaining the verdict'),
  }),
  results: z.array(verifierResultSchema),
});

export type VerifierOutput = z.infer<typeof VerifierOutputSchema>;
export type Verification = VerifierOutput['results'][number];
export type SummaryVerdict = VerifierOutput['summary']['verdict'];

export const VERIFIER_JSON_SCHEMA = toOpenAiSchema(VerifierOutputSchema);

/** The schema cannot know how many articles were fetched, so this also checks each source index. */
export function parseGeneratorOutput(value: unknown, articleCount: number): GeneratorOutput | null {
  const parsed = GeneratorOutputSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  for (const keyPoint of parsed.data.keyPoints) {
    for (const index of keyPoint.sourceIndexes) {
      if (index >= articleCount) {
        return null;
      }
    }
  }
  return parsed.data;
}

/** The schema cannot know the key point count, so this requires one verdict each and real indexes. */
export function parseVerifierOutput(value: unknown, keyPointCount: number): VerifierOutput | null {
  const parsed = VerifierOutputSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  if (parsed.data.results.length !== keyPointCount) {
    return null;
  }
  const seen = new Set<number>();
  for (const result of parsed.data.results) {
    if (result.keyPointIndex >= keyPointCount || seen.has(result.keyPointIndex)) {
      return null;
    }
    seen.add(result.keyPointIndex);
  }
  return parsed.data;
}
