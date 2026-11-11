// The report table: one row per report run. verifierStatus says what the verification step did, verifierError is why it failed (null when it did not). The JSON columns (articles, keyPoints, verification) are text.

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('report', (table) => {
    table.string('id').primary();
    table.string('ticker').notNullable();
    table.datetime('createdAt').notNullable();
    table.string('requestedModel').notNullable();
    table.string('responseModel');
    table.string('reasoning').notNullable();
    table.string('verifierModel');
    table.string('verifierReasoning');
    table.text('verification');
    table.string('verifierStatus').notNullable();
    table.text('verifierError');
    table.string('summaryVerdict');
    table.text('articles').notNullable();
    table.string('newsProvider').notNullable();
    table.string('newsFetchedAt').notNullable();
    table.text('summary');
    table.text('keyPoints');
    table.integer('inputTokens').notNullable();
    table.integer('outputTokens').notNullable();
    table.integer('verifierInputTokens').notNullable();
    table.integer('verifierOutputTokens').notNullable();
    table.integer('durationMs').notNullable();
    table.index('ticker', 'idx_report_ticker');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('report');
}
