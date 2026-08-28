import { HealthResponse, parseHealthResponse, parseTorCircuitResponse, TorCircuitResponse } from './vast-api-models';

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type VastApiClientOptions = {
  baseUrl: string;
  fetch?: FetchLike;
};

export class VastApiHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseText: string,
  ) {
    super(message);
    this.name = 'VastApiHttpError';
  }
}

export class VastApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: VastApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async getHealth(): Promise<HealthResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/vast/health`, {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new VastApiHttpError(
        `Vast API health check failed with HTTP ${response.status}`,
        response.status,
        await response.text(),
      );
    }

    return parseHealthResponse(await response.json());
  }

  async requestNewTorCircuit(): Promise<TorCircuitResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/private/tor/circuit`, {
      method: 'POST',
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new VastApiHttpError(
        `Vast API Tor circuit request failed with HTTP ${response.status}`,
        response.status,
        await response.text(),
      );
    }

    return parseTorCircuitResponse(await response.json());
  }
}
