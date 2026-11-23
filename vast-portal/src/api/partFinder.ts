import { useMemo } from 'react';

import useSWR from 'swr';

import type { PartColor, SetForSale } from 'types/partFinder';
import { fetcher } from 'utils/axios';

const endpoint = '/api/private/part-finder';

const options = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  keepPreviousData: true
};

/** Parts in a color matching the typed words, asked for only once there is something to search. */
export function useSearchPartColors(query: string) {
  const trimmed = query.trim();
  const requestKey = trimmed.length >= 2 ? `${endpoint}/parts?q=${encodeURIComponent(trimmed)}` : null;

  const { data, error, isLoading } = useSWR<PartColor[]>(requestKey, fetcher, options);

  return useMemo(
    () => ({
      partColors: requestKey ? data : undefined,
      partColorsError: error,
      partColorsLoading: isLoading
    }),
    [requestKey, data, error, isLoading]
  );
}

/** The sets for sale containing the chosen part, asked for only once one is chosen. */
export function useGetSetsForSale(partColor: PartColor | null) {
  const requestKey = partColor ? `${endpoint}/sets?partNum=${encodeURIComponent(partColor.partNum)}&colorId=${partColor.colorId}` : null;

  const { data, error, isLoading } = useSWR<SetForSale[]>(requestKey, fetcher, { ...options, keepPreviousData: false });

  return useMemo(
    () => ({
      sets: data,
      setsError: error,
      setsLoading: isLoading
    }),
    [data, error, isLoading]
  );
}
