import { describe, expect, it } from 'vitest';
import { YahooNewsProvider } from '../../news/YahooNewsProvider';

// Calls the real Yahoo Finance search endpoint.
describe('Yahoo news (real API)', () => {
  it('knows AAPL and returns articles', async () => {
    const result = await new YahooNewsProvider(10).fetchNews('AAPL');

    expect(result.known).toBe(true);
    expect(result.articles.length).toBeGreaterThan(0);
    expect(result.articles[0].title).toBeTruthy();
  });

  it('does not know a made-up ticker', async () => {
    const result = await new YahooNewsProvider(10).fetchNews('NOTAREALTICKER1');

    expect(result.known).toBe(false);
  });
});
