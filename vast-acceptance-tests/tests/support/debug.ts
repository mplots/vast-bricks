import type { APIRequestContext } from '@playwright/test';

export type DebugExchange = {
  id: number;
  recordedAt: string;
  provider: string;
  method: string;
  url: string;
  requestBody: string | null;
  statusCode: number;
  responseBody: string | null;
  durationMillis: number;
  truncated: boolean;
};

const endpoint = '/api/private/debug/http';

export async function setRecording(request: APIRequestContext, enabled: boolean) {
  const response = await request.post(`${endpoint}/recording`, { data: { enabled } });
  if (!response.ok()) {
    throw new Error(`Arming debug recording failed with HTTP ${response.status()}.`);
  }
  return (await response.json()) as { recording: boolean; recordingUntil: string | null };
}

/** Everything recorded for the caller so far, following the cursor so a scenario sees every page. */
export async function readExchanges(request: APIRequestContext): Promise<DebugExchange[]> {
  const collected: DebugExchange[] = [];
  let cursor: number | null = null;

  for (;;) {
    const query = cursor === null ? '' : `?afterId=${cursor}`;
    const response = await request.get(`${endpoint}/exchanges${query}`);
    if (!response.ok()) {
      throw new Error(`Reading debug exchanges failed with HTTP ${response.status()}.`);
    }
    const page = (await response.json()) as { exchanges: DebugExchange[]; nextCursor: number | null; more: boolean };
    collected.push(...page.exchanges);
    if (!page.more) {
      return collected;
    }
    cursor = page.nextCursor;
  }
}

export async function clearExchanges(request: APIRequestContext) {
  const response = await request.delete(`${endpoint}/exchanges`);
  if (!response.ok()) {
    throw new Error(`Clearing debug exchanges failed with HTTP ${response.status()}.`);
  }
}

export const providersOf = (exchanges: DebugExchange[]) => [...new Set(exchanges.map((exchange) => exchange.provider))].sort();
