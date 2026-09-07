import { useMemo } from 'react';

import useSWR from 'swr';

import type { StripeTransactionsPage } from 'types/stripeTransaction';
import { fetcher } from 'utils/axios';

const endpoint = '/api/private/stripe-transactions';

/**
 * The Stripe balance transactions of a period — `YYYY-MM` for a month, `YYYY` for a year — together with what they
 * came to.
 *
 * <p>Read from Stripe when the screen asks for it and stored nowhere, so a period is not revalidated behind the
 * reader's back: asking Stripe again is what the refresh button is for.
 */
export function useGetStripeTransactions(period: string) {
  const requestKey = useMemo(() => {
    if (!period) return null;
    const searchParams = new URLSearchParams({ period });
    return `${endpoint}?${searchParams.toString()}`;
  }, [period]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<StripeTransactionsPage>(requestKey, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      stripeTransactions: data?.transactions,
      stripeTransactionSummary: data?.summary,
      stripeTransactionsError: error,
      stripeTransactionsLoading: isLoading,
      stripeTransactionsRefreshing: isValidating,
      reloadStripeTransactions: mutate
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}
