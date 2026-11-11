import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryReportCache } from '../cache/InMemoryReportCache';
import type { ReportResponse } from '../services/ReportResponse';

// Only the id is used by these tests, so the rest of the response is left out.
function stored(id: string): ReportResponse {
  return { id } as ReportResponse;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2024-11-08T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('InMemoryReportCache', () => {
  it('returns a stored value (hit) and undefined for an unknown key (miss)', async () => {
    const cache = new InMemoryReportCache(30);
    await cache.set('AAPL', stored('value'));

    expect((await cache.get('AAPL'))?.id).toBe('value');
    expect(await cache.get('MSFT')).toBeUndefined();
  });

  it('expires entries after the TTL', async () => {
    const cache = new InMemoryReportCache(30);
    await cache.set('AAPL', stored('value'));

    vi.setSystemTime(new Date('2024-11-08T12:29:00.000Z'));
    expect((await cache.get('AAPL'))?.id).toBe('value');

    vi.setSystemTime(new Date('2024-11-08T12:31:00.000Z'));
    expect(await cache.get('AAPL')).toBeUndefined();
  });
});
