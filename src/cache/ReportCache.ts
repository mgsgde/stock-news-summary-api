// Finished report responses, keyed by ticker.
// ReportService reads and writes it.

import type { ReportResponse } from '../services/ReportResponse';

export interface ReportCache {
  // Promises, so a shared cache such as Redis can implement the same interface.
  get(key: string): Promise<ReportResponse | undefined>;
  set(key: string, value: ReportResponse): Promise<void>;
}
