/** One API key as a list of them shows it. The secret is never part of a read. */
export interface ApiKeyItem {
  id: number;
  name: string;
  /** The opening characters of the secret - the same fragment the external program shows. */
  tokenPrefix: string;
  createdAt: string;
  /** Null never expires, which is what a program left running needs. */
  expiresAt: string | null;
  lastUsedAt: string | null;
  expired: boolean;
}

/** The generation response, the one place the secret appears. Nothing stores it, so it is shown once. */
export interface GeneratedApiKey extends ApiKeyItem {
  token: string;
}

export interface CreateApiKeyRequest {
  name: string;
  /** Omitted or non-positive never expires. */
  expiresInDays?: number;
}
