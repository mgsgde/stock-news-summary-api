# Stock News Summary API

A REST API that returns an AI summary of the latest news for a stock. Every key point cites its sources and is checked by a second, stronger model. If that check fails, the report is still returned, marked `meta.verifierStatus: "failed"`.

A trader wants to know quickly what is happening with a stock: relevant, correct, current, with a source for every claim, often asked through ChatGPT or Claude. This API is the specialist such an assistant can call. It generates the report once and caches it for everyone.

```
GET /stocks/NVDA/report
```

Response (shortened):

```json
{
  "id": "df3293ec-…",
  "ticker": "NVDA",
  "disclaimer": "AI-generated summary of news headlines. It can contain errors and is not investment advice.",
  "summary": "Nvidia faces a board investigation into CEO Jensen Huang …",
  "keyPoints": [
    {
      "index": 0,
      "text": "Nvidia stock fell about 5% …",
      "sources": [0, 3],
      "verification": "supported"
    }
  ],
  "sources": [
    {
      "index": 0,
      "title": "…",
      "publisher": "Yahoo Finance",
      "url": "https://…",
      "publishedAt": "2026-11-09T16:31:30.000Z"
    }
  ],
  "meta": {
    "generatedAt": "…",
    "cached": false,
    "generator": { "model": "gpt-5-mini", "reasoning": "low" },
    "verifierStatus": "checked",
    "verifier": {
      "model": "gpt-5",
      "reasoning": "medium",
      "checked": 4,
      "removed": 1,
      "summaryReplaced": false
    }
  }
}
```

`sources` lists only the articles that the key points cite, each with its original `index` (so there can be gaps).

Errors: 400 invalid ticker, 404 unknown ticker, 502 when the news source or the generator fails. A verifier failure returns 200 with `verifierStatus: "failed"`. Full contract: `/openapi.json`.

## Quick start

Node 24 and an OpenAI API key.

```bash
npm install
cp .env.example .env    # set OPENAI_API_KEY
npm run dev
```

For a production run: `npm run build && npm start`.

Open http://localhost:3000/docs and try `AAPL` or `NVDA`. US tickers work best. Share classes like `BRK.B` are recognised, but Yahoo tags few articles with them, and most non-US tickers (for example `SAP.DE`) get no news. The first call takes 20–60 seconds, repeated calls come from the cache. With Docker: `docker compose up --build`.

## How it works

1. **News**: latest headlines for the ticker from Yahoo Finance. Only articles Yahoo tags with the ticker are used, because its search also returns stories about other companies (a ticker can end up with few or no articles). Articles older than 7 days (`NEWS_MAX_AGE_DAYS`) are dropped.
2. **Generator** (`gpt-5-mini`): writes a summary and up to 6 key points, each citing its articles. The answer follows a JSON schema (OpenAI Structured Outputs), is checked with zod and retried once if it fails the schema check. With off-topic news it may return no key points.
3. **Verifier** (`gpt-5`): a separate call judges every key point against the articles. Unsupported points are removed. If the summary text itself is not supported, it is replaced by the verified key points (`meta.verifier.summaryReplaced`).
4. **Store and cache**: the report, models and tokens go to SQLite. The response is cached for 30 minutes (`CACHE_TTL_MINUTES`), unless the verifier failed.

## Design decisions

- **Cache on request, not a nightly job.** The news must be current. Concurrent requests for the same ticker share one run, so on a single instance a ticker is normally paid for once per cache window (about 2 US cents, mostly the verifier).
- **Small model generates, strong model verifies.** Summarising headlines is easy, judging whether a claim follows from them is the hard part. One generator and one verifier are enough while the input is headlines only.
- **Interfaces for everything external.** `NewsProvider`, `LlmClient` and `ReportCache` are passed into `ReportService`, so a licensed news feed, another model or Redis is a new class, and tests use fakes.
- **tsoa** generates the routes and the OpenAPI response schemas from the controller's TypeScript types, so the documented shapes cannot drift from the code.
- **SQLite with Knex.** One file, no server, the migration runs on start. Postgres would be a different Knex client.
- **Disclaimer in every report.** A `disclaimer` field says the text is AI-generated, can contain errors and is not investment advice, and the prompt forbids advice and price predictions. Designed with the EU AI Act's transparency rules and investment-advice rules in mind, not a legal assessment.
- **Prompts as constants, no authentication.** Enough for a first version that runs locally with one key.
- **Yahoo Finance** needs no key but is unofficial, returns headlines only and little news for non-US tickers. Used here for demonstration only.

## Testing strategy

- `npm test`: offline and deterministic, no key, runs in CI. Unit tests for `ReportService` with fake news and a fake LLM (cache, shared runs, retries, verifier removing points, failures), schema tests, HTTP client tests with axios-mock-adapter, API tests with supertest and an in-memory database.
- `npm run test:integration`: against the real OpenAI and Yahoo with the key from `.env`, costs a few cents, not in CI.

Not tested automatically: whether a summary is good. Measuring that is the first item under Next steps.

## Known limitations and next steps

- **Quality evals.** A labelled set of tickers, precision and recall of the verifier, run in CI before every prompt change.
- **Failed verifications are not cached.** During a verifier outage every request pays for the generator again. Next: cache degraded reports for 1 to 2 minutes, or re-run only the verifier.
- **No retry with backoff** for OpenAI 429 and 5xx, and no overall request deadline.
- **The Yahoo payload is not validated.** A malformed item causes a 500 instead of being skipped.
- **No `?refresh=true`** to bypass the cache and no history endpoint (`GET /stocks/{ticker}/reports`).
- **Single instance.** The cache and the in-flight dedup are in memory and the database is SQLite. For several instances: Redis (SET NX with TTL) and Postgres.
- **No auth and no rate limiting.** Anyone who can reach the server spends the OpenAI key. Tokens per report are stored, the cost is not.

## Tools and techniques used

Built with Claude Code. The code was written by the AI, the decisions are mine:

- **Problem first.** Before any code I worked out the user story with Claude: who reads this and why. Traders and their AI agents need a short, sourced picture of a stock. An API is enough for that, and it fits a backend role better than a frontend would.
- **A stack I can explain.** TypeScript, Express, tsoa, Knex, zod, Vitest are the tools I used in my own projects before AI coding. I picked them because I understand them, not because they are the newest.
  - tsoa: the OpenAPI spec behind Swagger UI is generated from the TypeScript types, so the documented shapes cannot drift from the code.
  - Knex instead of TypeORM: a thin query builder with explicit migrations, no entities or decorators.
- **Two models.** A cheap model writes, a stronger one checks every key point against the sources. The cache makes that affordable: one report serves many readers and agents.
- **Metadata in every response.** Models, reasoning effort, sources, verifier result and cache state, so a reader or an agent can see how the report was made. Token counts are stored with each report in the database.
- **Kept simple on purpose.** SQLite and an in-memory cache instead of Postgres and Redis, a small generator model, Yahoo as a free news source. This is a first version to discuss, not a product. I would build the next steps with real users.
- **AI review.** After the first version I let AI agents review the repo from an interviewer's point of view and fixed what they found (verifier failure, prompt injection, disclaimer, old articles). Some gaps are left open on purpose and listed under Known limitations.
