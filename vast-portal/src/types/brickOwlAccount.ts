import type { OperatingPeriod } from './providerAccount';

/** BrickOwl's own config shape - the {@code config} of a provider account whose provider is {@code 'BRICK_OWL'}. */
export interface BrickOwlAccountConfig {
  provider: 'BRICK_OWL';
  /** Plaintext on a request; always null on a view - {@code apiKeyLength} is all a view ever says about it. */
  apiKey: string | null;
  /** How many characters the stored secret has, 0 when none is stored - enough to mask it at its own width. */
  apiKeyLength: number;
  /** The stretch of this store's orders that count, null for all of them. Not a secret: it is read back as written. */
  operatingPeriod: OperatingPeriod | null;
}
