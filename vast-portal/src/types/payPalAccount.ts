export type PayPalMode = 'SANDBOX' | 'LIVE';

/** PayPal's own config shape - the {@code config} of a provider account whose provider is {@code 'PAYPAL'}. */
export interface PayPalAccountConfig {
  provider: 'PAYPAL';
  clientId: string;
  /** Plaintext on a request; always null on a view - {@code clientSecretLength} is all a view ever says about it. */
  clientSecret: string | null;
  mode: PayPalMode;
  /** How many characters the stored secret has, 0 when none is stored - enough to mask it at its own width. */
  clientSecretLength: number;
}
