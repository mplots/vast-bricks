/**
 * Latvijas Pasts's own config shape - the {@code config} of a provider account whose provider is
 * {@code 'LATVIJAS_PASTS'}.
 *
 * <p>One account carries both ways the same postal account is reached: the shipping API's user and key, and the
 * Mans Pasts self-service sign-in used for the register the API does not expose.
 */
export interface LatvijasPastsAccountConfig {
  provider: 'LATVIJAS_PASTS';
  /** Plaintext on a request; always null on a view - the matching length is all a view ever says about it. */
  apiUser: string | null;
  apiKey: string | null;
  username: string | null;
  password: string | null;
  /** How many characters the stored secret has, 0 when none is stored - enough to mask it at its own width. */
  apiUserLength: number;
  apiKeyLength: number;
  usernameLength: number;
  passwordLength: number;
}
