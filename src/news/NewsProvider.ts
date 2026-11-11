// Headlines for one ticker. ReportService asks for them in step 1 of a report run.
// YahooNewsProvider is the real source. Tests pass FakeNewsProvider.

// Yahoo writes BRK-B where users type BRK.B. Cache keys and provider queries use this form,
// so both spellings are the same stock.
export function normaliseTicker(symbol: string): string {
  return symbol.toUpperCase().replace(/\./g, '-');
}

export interface Article {
  title: string;
  publisher: string;
  url: string;
  /** ISO 8601. */
  publishedAt: string;
}

export interface NewsResult {
  /** False when the provider does not recognise the ticker. ReportService turns that into 404. */
  known: boolean;
  articles: Article[];
}

export interface NewsProvider {
  /** Stored on the report, for example "yahoo". */
  readonly name: string;
  fetchNews(ticker: string): Promise<NewsResult>;
}
