import { useMemo } from 'react';

import useSWR from 'swr';

import type { BankStatementEntriesPage, BankStatementEntry, BankStatementImportResult } from 'types/bankStatement';
import axiosServices, { fetcher } from 'utils/axios';

const endpoint = '/api/private/bank-statements';

export function useGetBankStatementEntries(month: string) {
  const requestKey = useMemo(() => {
    if (!month) return null;
    const searchParams = new URLSearchParams({ month });
    return `${endpoint}/entries?${searchParams.toString()}`;
  }, [month]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<BankStatementEntriesPage>(requestKey, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      bankStatementEntries: data?.entries,
      bankStatementEntriesError: error,
      bankStatementEntriesLoading: isLoading,
      bankStatementEntriesRefreshing: isValidating,
      reloadBankStatementEntries: mutate
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

/**
 * Imports a camt.052 or camt.053 document. The document is the request body rather than a multipart part, so the
 * file's own text is what is sent and there is no upload size to configure on either side.
 */
export async function importBankStatement(document: string) {
  const { data } = await axiosServices.post<BankStatementImportResult>(endpoint, document, {
    headers: { 'Content-Type': 'application/xml' }
  });
  return data;
}

export async function updateBankStatementMapping(id: number, mapping: string) {
  const { data } = await axiosServices.put<BankStatementEntry>(`${endpoint}/entries/${id}/mapping`, { mapping });
  return data;
}
