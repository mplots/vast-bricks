/** Mana Kabata's own config shape - the {@code config} of a provider account whose provider is {@code 'MANA_KABATA'}. */
export interface ManaKabataAccountConfig {
  provider: 'MANA_KABATA';
  /** Plaintext on a request; always null on a view - {@code apiTokenLength} is all a view ever says about it. */
  apiToken: string | null;
  /** How many characters the stored secret has, 0 when none is stored - enough to mask it at its own width. */
  apiTokenLength: number;
}
