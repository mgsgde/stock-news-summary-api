import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, describe, expect, it } from 'vitest';
import { HttpError } from '../errors';
import { YahooNewsProvider } from '../news/YahooNewsProvider';

const URL = 'https://query1.finance.yahoo.com/v1/finance/search';
const mock = new MockAdapter(axios);

afterEach(() => {
  mock.reset();
});

describe('YahooNewsProvider', () => {
  it('returns articles for a known ticker', async () => {
    mock.onGet(URL).reply(200, {
      quotes: [{ symbol: 'AAPL' }],
      news: [
        {
          title: 'Apple launches new iPhone',
          publisher: 'Reuters',
          link: 'https://example.com/a',
          providerPublishTime: 1731000000,
          relatedTickers: ['AAPL'],
        },
      ],
    });

    const result = await new YahooNewsProvider(10).fetchNews('aapl');

    expect(result.known).toBe(true);
    expect(result.articles).toEqual([
      {
        title: 'Apple launches new iPhone',
        publisher: 'Reuters',
        url: 'https://example.com/a',
        publishedAt: '2024-11-07T17:20:00.000Z',
      },
    ]);
  });

  it('sorts newest first and drops duplicate urls and titles', async () => {
    const item = (title: string, link: string, time: number) => ({
      title,
      publisher: 'P',
      link,
      providerPublishTime: time,
      relatedTickers: ['AAPL'],
    });
    mock.onGet(URL).reply(200, {
      quotes: [{ symbol: 'AAPL' }],
      news: [
        item('Old story', 'https://example.com/old', 1000),
        item('New story', 'https://example.com/new', 3000),
        item('Same url', 'https://example.com/new', 2500),
        item('new story ', 'https://example.com/other', 2000),
        item('Middle story', 'https://example.com/mid', 2200),
      ],
    });

    const result = await new YahooNewsProvider(10).fetchNews('AAPL');

    expect(result.articles.map((a) => a.title)).toEqual(['New story', 'Middle story', 'Old story']);
  });

  it('sends ticker, limit and a browser-like user agent', async () => {
    mock.onGet(URL).reply(200, { quotes: [], news: [] });

    await new YahooNewsProvider(7).fetchNews('AAPL');

    const request = mock.history.get[0];
    expect(request.params).toEqual({ q: 'AAPL', quotesCount: 5, newsCount: 21 });
    expect(request.headers?.['User-Agent']).toContain('Mozilla/5.0');
  });

  it('marks an unknown ticker as not known', async () => {
    mock.onGet(URL).reply(200, { quotes: [], news: [] });

    const result = await new YahooNewsProvider(10).fetchNews('ZZZZ');

    expect(result.known).toBe(false);
    expect(result.articles).toEqual([]);
  });

  it('accepts the ticker anywhere in the quotes and treats . and - as equal', async () => {
    mock.onGet(URL).reply(200, { quotes: [{ symbol: 'BRKB' }, { symbol: 'BRK-B' }], news: [] });

    const result = await new YahooNewsProvider(10).fetchNews('brk.b');

    expect(result.known).toBe(true);
    // Yahoo searches for BRK-B, not BRK.B
    expect(mock.history.get[0].params).toMatchObject({ q: 'BRK-B' });
  });

  it('keeps only articles tagged with the ticker and cuts to the limit after that', async () => {
    const item = (n: number, tickers: string[]) => ({
      title: `Story ${n}`,
      publisher: 'P',
      link: `https://example.com/${n}`,
      providerPublishTime: 1000 + n,
      relatedTickers: tickers,
    });
    mock.onGet(URL).reply(200, {
      quotes: [{ symbol: 'GOOG' }],
      news: [
        item(5, ['MSFT']),
        item(4, ['goog', 'AMZN']),
        item(3, []),
        { ...item(2, []), relatedTickers: undefined },
        item(1, ['GOOG']),
        item(0, ['GOOG']),
      ],
    });

    const result = await new YahooNewsProvider(2).fetchNews('GOOG');

    expect(result.articles.map((a) => a.title)).toEqual(['Story 4', 'Story 1']);
  });

  it('does not treat a different symbol as known', async () => {
    mock.onGet(URL).reply(200, { quotes: [{ symbol: 'AAPL.MX' }], news: [] });

    const result = await new YahooNewsProvider(10).fetchNews('AAPL');

    expect(result.known).toBe(false);
  });

  it('throws HttpError (502) when Yahoo fails', async () => {
    mock.onGet(URL).reply(429);

    const promise = new YahooNewsProvider(10).fetchNews('AAPL');

    await expect(promise).rejects.toBeInstanceOf(HttpError);
    await expect(promise).rejects.toMatchObject({ status: 502 });
  });

  it('throws HttpError on a network error', async () => {
    mock.onGet(URL).networkError();

    await expect(new YahooNewsProvider(10).fetchNews('AAPL')).rejects.toBeInstanceOf(HttpError);
  });
});
