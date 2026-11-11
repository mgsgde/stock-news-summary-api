import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config';

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig({});
    expect(config.port).toBe(3000);
    expect(config.generatorModel).toBe('gpt-5-mini');
    expect(config.generatorReasoning).toBe('low');
    expect(config.verifierModel).toBe('gpt-5');
    expect(config.verifierReasoning).toBe('medium');
    expect(config.verify).toBe(true);
    expect(config.cacheTtlMinutes).toBe(30);
    expect(config.newsLimit).toBe(10);
    expect(config.newsMaxAgeDays).toBe(7);
    expect(config.databasePath).toBe('data/app.sqlite');
  });

  it('reads NEWS_MAX_AGE_DAYS and rejects a bad value', () => {
    expect(loadConfig({ NEWS_MAX_AGE_DAYS: '3' }).newsMaxAgeDays).toBe(3);
    expect(() => loadConfig({ NEWS_MAX_AGE_DAYS: '0' })).toThrow(/NEWS_MAX_AGE_DAYS/);
  });

  it('reads VERIFY=false and rejects a bad reasoning value', () => {
    expect(loadConfig({ VERIFY: 'false' }).verify).toBe(false);
    expect(() => loadConfig({ GENERATOR_REASONING: 'huge' })).toThrow(/GENERATOR_REASONING/);
  });

  it('uses the default for an empty model name', () => {
    const config = loadConfig({ GENERATOR_MODEL: '', VERIFIER_MODEL: '' });
    expect(config.generatorModel).toBe('gpt-5-mini');
    expect(config.verifierModel).toBe('gpt-5');
  });

  it('switches the verifier off for false and 0 in any case', () => {
    expect(loadConfig({ VERIFY: 'FALSE' }).verify).toBe(false);
    expect(loadConfig({ VERIFY: '0' }).verify).toBe(false);
    expect(loadConfig({ VERIFY: 'true' }).verify).toBe(true);
  });

  it('requires PORT and NEWS_LIMIT to be positive integers', () => {
    expect(() => loadConfig({ PORT: '3000.5' })).toThrow(/PORT/);
    expect(() => loadConfig({ PORT: '0' })).toThrow(/PORT/);
    expect(() => loadConfig({ NEWS_LIMIT: '2.5' })).toThrow(/NEWS_LIMIT/);
    expect(() => loadConfig({ NEWS_LIMIT: '-1' })).toThrow(/NEWS_LIMIT/);
    expect(loadConfig({ NEWS_LIMIT: '5' }).newsLimit).toBe(5);
  });
});
