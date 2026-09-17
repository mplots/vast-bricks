import { useMemo } from 'react';

import useSWR from 'swr';

import type { ShippingPriceCountry, ShippingPricesPage } from 'types/shippingPrices';
import { fetcher } from 'utils/axios';

const endpoint = '/api/private/shipping-prices';

/** The destinations there are prices for. Swept weekly, so there is nothing to revalidate on a focus. */
export function useGetShippingPriceCountries() {
  const { data, error, isLoading } = useSWR<ShippingPriceCountry[]>(`${endpoint}/countries`, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      countries: data,
      countriesError: error,
      countriesLoading: isLoading
    }),
    [data, error, isLoading]
  );
}

/** One destination's tariff, asked for only once a destination is chosen. */
export function useGetShippingPrices(country: string | null) {
  const requestKey = country ? `${endpoint}?country=${encodeURIComponent(country)}` : null;

  const { data, error, isLoading } = useSWR<ShippingPricesPage>(requestKey, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      shippingPrices: data,
      shippingPricesError: error,
      shippingPricesLoading: isLoading
    }),
    [data, error, isLoading]
  );
}
