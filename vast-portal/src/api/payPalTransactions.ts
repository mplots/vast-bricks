import { useMemo } from 'react';

import useSWR from 'swr';

import type { PayPalTransactionsPage } from 'types/payPalTransaction';
import { fetcher } from 'utils/axios';

const endpoint = '/api/private/paypal-transactions';

/**
 * The PayPal transactions of a period — `YYYY-MM` for a month, `YYYY` for a year — together with what they came to.
 *
 * <p>Read from PayPal when the screen asks for it and stored nowhere, so a period is not revalidated behind the
 * reader's back: asking PayPal again is what the refresh button is for.
 */
export function useGetPayPalTransactions(period: string) {
  const requestKey = useMemo(() => {
    if (!period) return null;
    const searchParams = new URLSearchParams({ period });
    return `${endpoint}?${searchParams.toString()}`;
  }, [period]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<PayPalTransactionsPage>(requestKey, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      payPalTransactions: data?.transactions,
      payPalTransactionSummary: data?.summary,
      payPalTransactionsError: error,
      payPalTransactionsLoading: isLoading,
      payPalTransactionsRefreshing: isValidating,
      reloadPayPalTransactions: mutate
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}
