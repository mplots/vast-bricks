import { useMemo } from 'react';

import useSWR from 'swr';

import type { StoreOrdersPage } from 'types/order';
import { fetcher } from 'utils/axios';

const endpoint = '/api/private/orders';

export function useGetOrders(from: string, to: string) {
  const requestKey = useMemo(() => {
    if (!from || !to || from > to) return null;
    return `${endpoint}?${new URLSearchParams({ from, to }).toString()}`;
  }, [from, to]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<StoreOrdersPage>(requestKey, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      orders: data,
      ordersError: error,
      ordersLoading: isLoading,
      // True for a reload of the range already shown as well, which `isLoading` is not.
      ordersRefreshing: isValidating,
      reloadOrders: mutate
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}
