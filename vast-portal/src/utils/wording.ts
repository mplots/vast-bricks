import type { IntlShape } from 'react-intl';

/**
 * A message where the catalog has one, and the provider's own word where it has not.
 *
 * <p>It is for the codes a provider states instead of words. Stripe names a balance transaction in English and the
 * screen shows it as Stripe wrote it; PayPal names one `T0006` and a status `S`, which say nothing to a reader, so
 * the ones a merchant account meets are worded here. The fallback is what keeps that from going quiet on the next
 * code PayPal adds: an unworded code reads as the code, which is still what a reader would search PayPal for.
 */
export const wordedOr = (intl: IntlShape, id: string, fallback: string) => (intl.messages[id] ? intl.formatMessage({ id }) : fallback);
