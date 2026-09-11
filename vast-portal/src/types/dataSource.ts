/** Every specific provider a data source can configure. Each has its own config shape, its own screen. */
export type DataSourceProvider = 'PAYPAL' | 'STRIPE';

/**
 * One data source: a list row, a single read, or a create/update request/response - the same shape serves all four,
 * config and all. {@code id} and {@code provider} are server-assigned and ignored on a request.
 */
export interface DataSourceItem<TConfig = unknown> {
  id?: number;
  name: string;
  provider?: DataSourceProvider;
  enabled: boolean;
  config: TConfig;
}
