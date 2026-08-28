import { useMemo } from 'react';

import useSWR from 'swr';

import type { ArchivesPage } from 'types/archives';
import axiosServices, { fetcher } from 'utils/axios';

const endpoint = '/api/private/archives';

export function useGetArchives(month: string) {
  const requestKey = useMemo(() => {
    const searchParams = new URLSearchParams();
    if (month) searchParams.set('month', month);
    const query = searchParams.toString();
    return `${endpoint}${query ? `?${query}` : ''}`;
  }, [month]);

  const { data, error, isLoading, mutate } = useSWR<ArchivesPage>(requestKey, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      archives: data,
      archivesError: error,
      archivesLoading: isLoading,
      reloadArchives: mutate
    }),
    [data, error, isLoading, mutate]
  );
}

export async function downloadMissingArchives(orderId: string) {
  await axiosServices.post(`${endpoint}/${encodeURIComponent(orderId)}/download-missing`);
}
