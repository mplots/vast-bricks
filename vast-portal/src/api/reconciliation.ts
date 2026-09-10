import { useMemo } from 'react';

import useSWR from 'swr';

import type { ReconciliationOrdersPage } from 'types/reconciliation';
import { fetcher } from 'utils/axios';

const endpoint = '/api/private/reconciliation/orders';

export function useGetReconciliationOrders(from: string, to: string) {
  const requestKey = useMemo(() => {
    if (!from || !to || from > to) return null;
    const searchParams = new URLSearchParams({ from, to });
    return `${endpoint}?${searchParams.toString()}`;
  }, [from, to]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<ReconciliationOrdersPage>(requestKey, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      reconciliationOrders: data,
      reconciliationOrdersError: error,
      reconciliationOrdersLoading: isLoading,
      // True for a reload of the month already shown as well, which `isLoading` is not: it stays false while the
      // orders on screen are being collected again.
      reconciliationOrdersRefreshing: isValidating,
      reloadReconciliationOrders: mutate
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}
