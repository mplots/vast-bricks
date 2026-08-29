import type { APIRequestContext, TestInfo } from '@playwright/test';

export type WireMockMode = 'parallel' | 'serial';
export type WireMockMethod = 'ANY' | 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

type WireMockValueMatcher = {
  equalTo?: string;
  contains?: string;
  matches?: string;
};

type WireMockBodyPattern = {
  contains: string;
};

type WireMockRequestPattern = {
  method?: WireMockMethod;
  urlPath?: string;
  urlPattern?: string;
  headers?: Record<string, WireMockValueMatcher>;
  bodyPatterns?: WireMockBodyPattern[];
};

type WireMockResponse = {
  status: number;
  headers?: Record<string, string>;
  body?: string;
};

type WireMockMapping = {
  priority?: number;
  request: WireMockRequestPattern;
  response: WireMockResponse;
  metadata?: Record<string, unknown>;
};

type WireMockResponseOptions = Partial<WireMockResponse> & {
  json?: unknown;
};

type WireMockHostMappingOptions = {
  request?: Omit<WireMockRequestPattern, 'method' | 'urlPath'>;
  response?: WireMockResponseOptions;
  metadata?: Record<string, unknown>;
};

type WireMockRecordedRequestData = {
  method?: string;
  url?: string;
  absoluteUrl?: string;
  headers?: Record<string, string>;
  body?: string;
  bodyAsBase64?: string;
};

type WireMockServeEvent = WireMockRecordedRequestData & {
  request?: WireMockRecordedRequestData;
};

type WireMockFindRequestsApiResponse = {
  requests: WireMockServeEvent[];
};

export class WireMockRecordedRequest {
  constructor(private readonly request: WireMockRecordedRequestData) {}

  get url(): string | undefined {
    return this.request.url;
  }

  get headers(): Record<string, string> {
    return this.request.headers ?? {};
  }

  headerValue(name: string): string {
    const header = Object.entries(this.headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (!header) {
      throw new Error(`Header '${name}' was not found.`);
    }
    return header[1];
  }

  body(): Buffer {
    if (this.request.bodyAsBase64) {
      return Buffer.from(this.request.bodyAsBase64, 'base64');
    }
    return Buffer.from(this.request.body ?? '', 'utf8');
  }

  text(): string {
    return this.body().toString('utf8');
  }

  form(): URLSearchParams {
    return new URLSearchParams(this.text());
  }
}

export class WireMockApi {
  static forTest(request: APIRequestContext, testInfo: TestInfo) {
    return new WireMockApi(request, wireMockBaseUrlForTest(testInfo), wireMockHostHeaderForTest(testInfo), wireMockMode());
  }

  constructor(
    readonly request: APIRequestContext,
    readonly baseUrl = process.env.ACCEPTANCE_WIREMOCK_URL ?? 'http://localhost:9010',
    readonly hostHeader = new URL(baseUrl).host,
    readonly mode: WireMockMode = wireMockMode(),
  ) {}

  async reset() {
    if (this.mode === 'serial') {
      await this.call('delete', '/__admin/mappings', 'WireMock mappings reset failed');
      await this.call('delete', '/__admin/requests', 'WireMock requests reset failed');
      return;
    }

    await this.call('post', '/__admin/requests/remove', 'WireMock request removal failed', this.forCurrentHost({
      method: 'ANY',
      urlPattern: '.*',
    }));
    await this.call('post', '/__admin/mappings/remove-by-metadata', 'WireMock mapping removal failed', {
      matchesJsonPath: {
        expression: '$.wireMockHost',
        equalTo: this.hostHeader,
      },
    });
  }

  async addMethodHostMapping(method: WireMockMethod, urlPath: string, options: WireMockHostMappingOptions = {}) {
    await this.addMapping({
      request: {
        ...this.forCurrentHost({
          ...options.request,
          method,
          urlPath,
        }),
      },
      response: this.responseFromOptions(options.response),
      metadata: options.metadata,
    });
  }

  async findMethodHostRequests(
    method: WireMockMethod,
    urlPath: string,
    request: Omit<WireMockRequestPattern, 'method' | 'urlPath'> = {},
  ): Promise<WireMockRecordedRequest[]> {
    const result = await this.call<WireMockFindRequestsApiResponse>(
      'post',
      '/__admin/requests/find',
      'WireMock request search failed',
      this.forCurrentHost({
        ...request,
        method,
        urlPath,
      }),
    );
    return result.requests.map((event) => new WireMockRecordedRequest(event.request ?? event));
  }

  private async addMapping(mapping: WireMockMapping) {
    await this.call('post', '/__admin/mappings', 'WireMock mapping creation failed', {
      ...mapping,
      metadata: {
        ...mapping.metadata,
        wireMockHost: this.hostHeader,
      },
    });
  }

  private forCurrentHost(pattern: WireMockRequestPattern): WireMockRequestPattern {
    return {
      ...pattern,
      headers: {
        ...pattern.headers,
        Host: {
          equalTo: this.hostHeader,
        },
      },
    };
  }

  private responseFromOptions(options: WireMockResponseOptions = {}): WireMockResponse {
    const { json, ...response } = options;

    if (json === undefined) {
      return {
        status: 200,
        ...response,
      };
    }

    return {
      status: 200,
      ...response,
      headers: {
        'Content-Type': 'application/json',
        ...response.headers,
      },
      body: JSON.stringify(json),
    };
  }

  private async call<T = void>(
    method: 'delete' | 'post',
    path: string,
    errorMessage: string,
    body?: unknown,
  ): Promise<T> {
    const response = await this.request[method](`${this.baseUrl}${path}`, {
      data: body,
    });

    if (!response.ok()) {
      throw new Error(`${errorMessage}: HTTP ${response.status()} ${await response.text()}`);
    }

    const contentType = response.headers()['content-type'] ?? '';
    const bodyBytes = await response.body();
    if (contentType.includes('application/json') && bodyBytes.length > 0) {
      return JSON.parse(bodyBytes.toString()) as T;
    }
    return undefined as T;
  }
}

export function wireMockMode(): WireMockMode {
  return process.env.ACCEPTANCE_WIREMOCK_MODE === 'parallel' ? 'parallel' : 'serial';
}

export function wireMockBaseUrlForTest(testInfo: TestInfo): string {
  const configuredUrl = process.env.ACCEPTANCE_WIREMOCK_URL ?? 'http://localhost:9010';
  if (wireMockMode() === 'serial') {
    return configuredUrl;
  }
  return `http://${wireMockHostForTest(testInfo)}:${new URL(configuredUrl).port || '80'}`;
}

export function wireMockHostHeaderForTest(testInfo: TestInfo): string {
  return new URL(wireMockBaseUrlForTest(testInfo)).host;
}

function wireMockHostForTest(testInfo: TestInfo): string {
  const hosts = wireMockHosts();
  return hosts[testInfo.parallelIndex] ?? hosts[0] ?? new URL(process.env.ACCEPTANCE_WIREMOCK_URL ?? 'http://localhost:9010').hostname;
}

function wireMockHosts(): string[] {
  const value = process.env.ACCEPTANCE_WIREMOCK_HOSTS;
  if (!value?.trim()) {
    return [new URL(process.env.ACCEPTANCE_WIREMOCK_URL ?? 'http://localhost:9010').hostname];
  }
  return value.split(',').map((host) => host.trim()).filter(Boolean);
}
