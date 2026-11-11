// Environment variables, read once at startup into a Config object.
// index.ts calls loadConfig(). Later code uses that object and does not read process.env.

export type Reasoning = 'minimal' | 'low' | 'medium' | 'high';

export interface Config {
  port: number;
  openaiApiKey: string | undefined;
  generatorModel: string;
  generatorReasoning: Reasoning;
  verifierModel: string;
  verifierReasoning: Reasoning;
  verify: boolean;
  cacheTtlMinutes: number;
  newsLimit: number;
  newsMaxAgeDays: number;
  databasePath: string;
}

function readReasoning(value: string, name: string): Reasoning {
  if (value === 'minimal' || value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  throw new Error(`${name} must be one of minimal, low, medium, high (got "${value}")`);
}

function readNumber(value: string, name: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive number (got "${value}")`);
  }
  return n;
}

function readPositiveInteger(value: string, name: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer (got "${value}")`);
  }
  return n;
}

/** Fails immediately when a number or a reasoning level is not usable. VERIFY is off for false or 0. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: readPositiveInteger(env.PORT || '3000', 'PORT'),
    openaiApiKey: env.OPENAI_API_KEY || undefined,
    generatorModel: env.GENERATOR_MODEL || 'gpt-5-mini',
    generatorReasoning: readReasoning(env.GENERATOR_REASONING ?? 'low', 'GENERATOR_REASONING'),
    verifierModel: env.VERIFIER_MODEL || 'gpt-5',
    verifierReasoning: readReasoning(env.VERIFIER_REASONING ?? 'medium', 'VERIFIER_REASONING'),
    verify: !['false', '0'].includes((env.VERIFY ?? '').toLowerCase()),
    cacheTtlMinutes: readNumber(env.CACHE_TTL_MINUTES ?? '30', 'CACHE_TTL_MINUTES'),
    newsLimit: readPositiveInteger(env.NEWS_LIMIT ?? '10', 'NEWS_LIMIT'),
    newsMaxAgeDays: readNumber(env.NEWS_MAX_AGE_DAYS ?? '7', 'NEWS_MAX_AGE_DAYS'),
    databasePath: env.DATABASE_PATH ?? 'data/app.sqlite',
  };
}
