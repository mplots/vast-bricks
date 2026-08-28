export type HealthResponse = {
  status: 'UP';
};

export type TorCircuitResponse = {
  previousIpAddress: string;
  currentIpAddress: string;
  changed: boolean;
  elapsedMillis: number;
  attempts: number;
};

export function parseHealthResponse(value: unknown): HealthResponse {
  if (!value || typeof value !== 'object' || !('status' in value)) {
    throw new Error('Invalid health response: missing status.');
  }

  const status = (value as { status: unknown }).status;
  if (status !== 'UP') {
    throw new Error(`Invalid health response status: ${String(status)}.`);
  }

  return { status };
}

export function parseTorCircuitResponse(value: unknown): TorCircuitResponse {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid Tor circuit response: expected an object.');
  }

  const response = value as {
    previousIpAddress?: unknown;
    currentIpAddress?: unknown;
    changed?: unknown;
    elapsedMillis?: unknown;
    attempts?: unknown;
  };

  if (typeof response.previousIpAddress !== 'string' || response.previousIpAddress.length === 0) {
    throw new Error('Invalid Tor circuit response: missing previousIpAddress.');
  }

  if (typeof response.currentIpAddress !== 'string' || response.currentIpAddress.length === 0) {
    throw new Error('Invalid Tor circuit response: missing currentIpAddress.');
  }

  if (typeof response.changed !== 'boolean') {
    throw new Error('Invalid Tor circuit response: missing changed.');
  }

  if (typeof response.elapsedMillis !== 'number' || response.elapsedMillis < 0) {
    throw new Error('Invalid Tor circuit response: missing elapsedMillis.');
  }

  if (typeof response.attempts !== 'number' || !Number.isInteger(response.attempts) || response.attempts < 1) {
    throw new Error('Invalid Tor circuit response: missing attempts.');
  }

  return {
    previousIpAddress: response.previousIpAddress,
    currentIpAddress: response.currentIpAddress,
    changed: response.changed,
    elapsedMillis: response.elapsedMillis,
    attempts: response.attempts,
  };
}
