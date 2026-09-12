/**
 * BrickLink's own config shape - the {@code config} of a provider account whose provider is {@code 'BRICK_LINK'}.
 *
 * <p>One account carries both sets of credentials that reach the same store: the store API's OAuth four, and the
 * session token the store pages are read with.
 */
export interface BrickLinkAccountConfig {
  provider: 'BRICK_LINK';
  /** Plaintext on a request; always null on a view - the matching length is all a view ever says about it. */
  consumerKey: string | null;
  consumerSecret: string | null;
  tokenValue: string | null;
  tokenSecret: string | null;
  brickStoreToken: string | null;
  /** How many characters the stored secret has, 0 when none is stored - enough to mask it at its own width. */
  consumerKeyLength: number;
  consumerSecretLength: number;
  tokenValueLength: number;
  tokenSecretLength: number;
  brickStoreTokenLength: number;
}
