import type { Article, NewsProvider, NewsResult } from '../../news/NewsProvider';

export class FakeNewsProvider implements NewsProvider {
  readonly name = 'fake';
  known = true;
  articles: Article[] = [];
  error: Error | null = null;
  calls: string[] = [];

  fetchNews(ticker: string): Promise<NewsResult> {
    this.calls.push(ticker);
    if (this.error) {
      return Promise.reject(this.error);
    }
    return Promise.resolve({ known: this.known, articles: this.articles });
  }
}
