// Map-based ReportCache. An entry lives for CACHE_TTL_MINUTES, then the next request generates again.
// Each API process has its own map. A shared cache would be another class with the same methods.

import type { ReportResponse } from '../services/ReportResponse';
import type { ReportCache } from './ReportCache';

interface Entry {
  value: ReportResponse;
  expiresAt: number;
}

export class InMemoryReportCache implements ReportCache {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly ttlMinutes: number) {}

  get(key: string): Promise<ReportResponse | undefined> {
    const entry = this.entries.get(key);
    if (!entry) {
      return Promise.resolve(undefined);
    }
    // Too old: delete it, so the caller starts a new run.
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return Promise.resolve(undefined);
    }
    return Promise.resolve(entry.value);
  }

  set(key: string, value: ReportResponse): Promise<void> {
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMinutes * 60 * 1000 });
    return Promise.resolve();
  }
}
