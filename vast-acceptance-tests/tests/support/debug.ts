import type { APIRequestContext } from '@playwright/test';

export type DebugExchange = {
  id: number;
  recordedAt: string;
  provider: string;
  method: string;
  url: string;
  /** The body as text, or the note standing in for one the backend kept as a file. */
  requestBody: string | null;
  requestFile: DebugBodyFile | null;
  statusCode: number;
  responseBody: string | null;
  responseFile: DebugBodyFile | null;
  durationMillis: number;
  truncated: boolean;
};

/** A body kept as a file rather than as text, and what downloading it hands over. */
export type DebugBodyFile = {
  contentType: string | null;
  size: number;
  filename: string;
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

/** Downloads one recorded body as the file the provider sent, as the panel's download button does. */
export async function downloadBody(
  request: APIRequestContext,
  id: number,
  side: 'request' | 'response',
) {
  const response = await request.get(`${endpoint}/exchanges/${id}/${side}-body`);
  if (!response.ok()) {
    throw new Error(`Downloading a recorded body failed with HTTP ${response.status()}.`);
  }
  return {
    contentType: response.headers()['content-type'] ?? '',
    disposition: response.headers()['content-disposition'] ?? '',
    bytes: await response.body(),
  };
}

export const providersOf = (exchanges: DebugExchange[]) => [...new Set(exchanges.map((exchange) => exchange.provider))].sort();
