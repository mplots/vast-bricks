/** Stripe's own config shape - the {@code config} of a provider account whose provider is {@code 'STRIPE'}. */
export interface StripeAccountConfig {
  provider: 'STRIPE';
  /** Plaintext on a request; always null on a view - {@code secretKeyLength} is all a view ever says about it. */
  secretKey: string | null;
  /** How many characters the stored secret has, 0 when none is stored - enough to mask it at its own width. */
  secretKeyLength: number;
}
