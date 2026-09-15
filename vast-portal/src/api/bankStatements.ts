import { useMemo } from 'react';

import useSWR from 'swr';

import type { BankStatementEntriesPage, BankStatementEntry, BankStatementImportResult } from 'types/bankStatement';
import axiosServices, { fetcher } from 'utils/axios';
import type { PeriodRange } from 'utils/period';

const endpoint = '/api/private/bank-statements';

/**
 * The entries booked between two days, both ends included, together with what they came to.
 *
 * <p>Asked for as a pair of days rather than as the month or year it may happen to be, because the screen's picker
 * draws spans that are neither — the same spans the reconciliation report is read in, which a link into the matching
 * split carries over. The endpoint still takes a whole month or year by name for a caller that has one; this one
 * always has both ends in hand, so it says them.
 */
export function useGetBankStatementEntries({ from, to }: PeriodRange) {
  const requestKey = useMemo(() => {
    if (!from || !to) return null;
    const searchParams = new URLSearchParams({ from, to });
    return `${endpoint}/entries?${searchParams.toString()}`;
  }, [from, to]);

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
