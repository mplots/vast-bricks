import { useMemo } from 'react';

import useSWR from 'swr';

import { fetcher } from 'utils/axios';
import { ProductDetails, ProductQueryParams } from 'types/product';

const endpoints = {
  list: '/api/product-details'
};

const buildQueryString = (params: ProductQueryParams) => {
  const searchParams = new URLSearchParams();

  if (params.limit) {
    searchParams.set('limit', String(params.limit));
  }

  if (params.set) {
    searchParams.set('set', String(params.set));
  }

  if (params.ean) {
    searchParams.set('ean', String(params.ean));
  }

  if (typeof params.atl === 'boolean') {
    searchParams.set('atl', String(params.atl));
  }

  params.stores?.forEach((store) => {
    if (store) {
      searchParams.append('stores', store);
    }
  });

  params.themes?.forEach((theme) => {
    if (theme) {
      searchParams.append('themes', theme);
    }
  });

  return searchParams.toString();
};

export function useGetProducts(query: ProductQueryParams = {}) {
  const requestKey = useMemo(() => {
    const qs = buildQueryString(query);
    return `${endpoints.list}${qs ? `?${qs}` : ''}`;
  }, [query]);

  const { data, error, isLoading, mutate } = useSWR<ProductDetails[]>(requestKey, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const memoizedValue = useMemo(
    () => ({
      products: data ?? [],
      productsError: error,
      productsLoading: isLoading,
      reloadProducts: mutate
    }),
    [data, error, isLoading, mutate]
  );

  return memoizedValue;
}

export type { ProductDetails, ProductQueryParams };
