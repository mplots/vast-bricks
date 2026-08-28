import { useMemo } from 'react';

import useSWR from 'swr';

import type { AccountingPage, GenerateInvoiceResult } from 'types/accounting';
import axiosServices, { fetcher } from 'utils/axios';

const endpoint = '/api/private/accounting';

export function useGetAccounting(month: string) {
  const requestKey = useMemo(() => {
    const searchParams = new URLSearchParams();
    if (month) searchParams.set('month', month);
    const query = searchParams.toString();
    return `${endpoint}${query ? `?${query}` : ''}`;
  }, [month]);

  const { data, error, isLoading, mutate } = useSWR<AccountingPage>(requestKey, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      accounting: data,
      accountingError: error,
      accountingLoading: isLoading,
      reloadAccounting: mutate
    }),
    [data, error, isLoading, mutate]
  );
}

export async function generateInvoice(orderId: string, source: string) {
  const response = await axiosServices.post<GenerateInvoiceResult>(`${endpoint}/invoices`, { orderId, source });
  return response.data;
}
