import type { Knex } from 'knex';
import { loadConfig } from '../config';
import type { Report } from '../db/Report';
import type { Config } from '../config';
import type { Article } from '../news/NewsProvider';
import type { SummaryVerdict, Verification } from '../services/schemas';
import type { FakeLlmClient } from './fakes/FakeLlmClient';

export function makeConfig(overrides: Partial<Config> = {}): Config {
  const base = loadConfig({});
  return { ...base, ...overrides };
}

export function makeArticles(count: number): Article[] {
  const articles: Article[] = [];
  for (let i = 0; i < count; i++) {
    articles.push({
      title: `Headline ${i}`,
      publisher: `Publisher ${i}`,
      url: `https://example.com/${i}`,
      publishedAt: '2024-11-07T17:20:00.000Z',
    });
  }
  return articles;
}

// Valid generator output with the given key point texts. Key point i cites article i.
export function generatorOutput(texts: string[]) {
  return {
    summary: 'A short summary.',
    keyPoints: texts.map((text, i) => ({ text, sourceIndexes: [i] })),
  };
}

export type Verdict = Verification['verdict'];

export function verifierOutput(verdicts: Verdict[], summaryVerdict: SummaryVerdict = 'supported') {
  return {
    summary: { verdict: summaryVerdict, note: 'summary note' },
    results: verdicts.map((verdict, i) => ({ keyPointIndex: i, verdict, note: `note ${i}` })),
  };
}

// Queues the two answers of a normal run with 3 key points. The fake answers in the order of the
// calls: the generator asks first, then the verifier.
export function enqueueRun(
  llm: FakeLlmClient,
  verdicts: Verdict[] = ['supported', 'supported', 'supported'],
): void {
  llm.enqueue(generatorOutput(['Point A', 'Point B', 'Point C']));
  llm.enqueue(verifierOutput(verdicts));
}

// A row of the report table as SQLite returns it: the JSON fields are text.
export type ReportRow = Omit<Report, 'createdAt' | 'articles' | 'keyPoints' | 'verification'> & {
  // SQLite stores the Date as milliseconds.
  createdAt: number;
  articles: string;
  keyPoints: string | null;
  verification: string | null;
};

// Reads all stored reports and parses the JSON text columns back into arrays.
export async function readReports(db: Knex): Promise<Report[]> {
  const rows = await db<ReportRow>('report').select();
  return rows.map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt),
    articles: JSON.parse(row.articles) as Report['articles'],
    keyPoints: row.keyPoints ? (JSON.parse(row.keyPoints) as Report['keyPoints']) : null,
    verification: row.verification
      ? (JSON.parse(row.verification) as Report['verification'])
      : null,
  }));
}

export async function readReport(db: Knex, id: string): Promise<Report> {
  const report = (await readReports(db)).find((entry) => entry.id === id);
  if (!report) {
    throw new Error(`Report ${id} not found`);
  }
  return report;
}
