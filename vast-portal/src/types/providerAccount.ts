/** Every external party a tenant can hold an account with. Each has its own config shape, its own screen. */
export type Provider = 'BRICK_LINK' | 'BRICK_OWL' | 'LATVIJAS_PASTS' | 'MANA_KABATA' | 'PAYPAL' | 'STRIPE';

/**
 * One stretch of an account's data that counts. Either date left null is that side unbounded: no `from` is since
 * forever, no `to` is ongoing. Dates travel as `yyyy-MM-dd`, as everywhere else in the portal.
 */
export interface OperatingPeriod {
  from: string | null;
  to: string | null;
  note: string | null;
}

/**
 * One provider account: a list row, a single read, or a create/update request/response - the same shape serves all four,
 * config and all. {@code id} and {@code provider} are server-assigned and ignored on a request.
 */
export interface ProviderAccountItem<TConfig = unknown> {
  id?: number;
  name: string;
  provider?: Provider;
  enabled: boolean;
  config: TConfig;
  /** Omitting these on a save clears them: an account with none takes everything it holds. */
  operatingPeriods?: OperatingPeriod[];
}
