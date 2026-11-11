// Step 1 of a report run: latest headlines from the Yahoo Finance search endpoint.
// No API key. ReportService treats known: false as an unknown ticker (404).

import axios from 'axios';
import { HttpError } from '../errors';
import { normaliseTicker } from './NewsProvider';
import type { Article, NewsProvider, NewsResult } from './NewsProvider';

const YAHOO_SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance/search';

interface YahooSearchResponse {
  quotes?: { symbol?: string }[];
  news?: {
    title: string;
    publisher: string;
    link: string;
    providerPublishTime: number;
    relatedTickers?: string[];
  }[];
}

export class YahooNewsProvider implements NewsProvider {
  readonly name = 'yahoo';

  constructor(private readonly newsLimit: number) {}

  async fetchNews(ticker: string): Promise<NewsResult> {
    let data: YahooSearchResponse;
    try {
      const response = await axios.get<YahooSearchResponse>(YAHOO_SEARCH_URL, {
        params: { q: normaliseTicker(ticker), quotesCount: 5, newsCount: this.newsLimit * 3 },
        // Without a browser-like User-Agent, Yahoo answers 429.
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-news-summary-api)' },
        timeout: 10000,
      });
      data = response.data;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      throw new HttpError(502, `News provider request failed: ${reason}`);
    }

    // The ticker can be any of the returned symbols, not only the first one.
    const wanted = normaliseTicker(ticker);
    const known = (data.quotes ?? []).some(
      (quote) => normaliseTicker(quote.symbol ?? '') === wanted,
    );

    // q= is a keyword search, so it also returns stories about other companies. Keep only
    // stories Yahoo tags with this ticker. Few left is fine, the report then says little news.
    const items = (data.news ?? []).filter((item) =>
      (item.relatedTickers ?? []).some((related) => normaliseTicker(related) === wanted),
    );
    // Newest first. providerPublishTime is seconds since 1970.
    items.sort((a, b) => b.providerPublishTime - a.providerPublishTime);
    const allArticles: Article[] = items.map((item) => ({
      title: item.title,
      publisher: item.publisher,
      url: item.link,
      publishedAt: new Date(item.providerPublishTime * 1000).toISOString(),
    }));

    // The same story often shows up twice, under the same link or the same headline.
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const articles: Article[] = [];
    for (const article of allArticles) {
      const title = article.title.trim().toLowerCase();
      if (seenUrls.has(article.url) || seenTitles.has(title)) {
        continue;
      }
      seenUrls.add(article.url);
      seenTitles.add(title);
      articles.push(article);
    }
    // Asked for more than newsLimit above, so cut to the limit only after filtering and dedupe.
    return { known, articles: articles.slice(0, this.newsLimit) };
  }
}
