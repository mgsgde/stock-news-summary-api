// Process entry. Loads config, opens SQLite, builds the real clients and starts HTTP.
// The tests do not start here. They call createApp() and pass fakes for news and the model.

import 'dotenv/config';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { createApp } from './app';
import { InMemoryReportCache } from './cache/InMemoryReportCache';
import { loadConfig } from './config';
import { createDatabase, migrateDatabase } from './db/database';
import { OpenAiClient } from './llm/OpenAiClient';
import { YahooNewsProvider } from './news/YahooNewsProvider';
import { ReportService } from './services/ReportService';

async function main(): Promise<void> {
  const config = loadConfig();

  // SQLite needs the parent folder to exist. An in-memory database has no file.
  if (config.databasePath !== ':memory:') {
    mkdirSync(dirname(config.databasePath), { recursive: true });
  }
  // The migrations run before the first request.
  const db = createDatabase(config.databasePath);
  await migrateDatabase(db);

  const cache = new InMemoryReportCache(config.cacheTtlMinutes);
  const reportService = new ReportService({
    db,
    news: new YahooNewsProvider(config.newsLimit),
    llm: new OpenAiClient(config.openaiApiKey),
    cache,
    config,
  });

  const app = createApp(reportService);
  app.listen(config.port, () => {
    console.log(`API docs: http://localhost:${config.port}/docs`);
  });
}

main().catch((error: unknown) => {
  console.error('Startup failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
