import { useMemo } from 'react';

import useSWR from 'swr';

import type { ReconciliationOrdersPage } from 'types/reconciliation';
import { fetcher } from 'utils/axios';

const endpoint = '/api/private/reconciliation/orders';

export function useGetReconciliationOrders(month: string) {
  const requestKey = useMemo(() => {
    if (!month) return null;
    const searchParams = new URLSearchParams({ month });
    return `${endpoint}?${searchParams.toString()}`;
  }, [month]);

  const { data, error, isLoading, mutate } = useSWR<ReconciliationOrdersPage>(requestKey, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      reconciliationOrders: data,
      reconciliationOrdersError: error,
      reconciliationOrdersLoading: isLoading,
      reloadReconciliationOrders: mutate
    }),
    [data, error, isLoading, mutate]
  );
}
