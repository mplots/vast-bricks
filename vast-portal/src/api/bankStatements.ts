import { useMemo } from 'react';

import useSWR from 'swr';

import type { BankStatementEntriesPage, BankStatementEntry, BankStatementImportResult } from 'types/bankStatement';
import axiosServices, { fetcher } from 'utils/axios';

const endpoint = '/api/private/bank-statements';

/** The entries of a period — `YYYY-MM` for a month, `YYYY` for a year — together with what they came to. */
export function useGetBankStatementEntries(period: string) {
  const requestKey = useMemo(() => {
    if (!period) return null;
    const searchParams = new URLSearchParams({ period });
    return `${endpoint}/entries?${searchParams.toString()}`;
  }, [period]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<BankStatementEntriesPage>(requestKey, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      bankStatementEntries: data?.entries,
      bankStatementSummary: data?.summary,
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
