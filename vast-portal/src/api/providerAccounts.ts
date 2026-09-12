import { useMemo } from 'react';

import useSWR from 'swr';

import type { ProviderAccountItem } from 'types/providerAccount';
import axiosServices, { fetcher } from 'utils/axios';

const endpoint = '/api/private/provider-accounts';

/** Every provider account the tenant being served has configured, whatever its provider. */
export function useGetProviderAccounts() {
  const { data, error, isLoading, mutate } = useSWR<ProviderAccountItem[]>(endpoint, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      providerAccounts: data,
      providerAccountsError: error,
      providerAccountsLoading: isLoading,
      reloadProviderAccounts: mutate
    }),
    [data, error, isLoading, mutate]
  );
}

export async function getProviderAccount<TConfig>(id: number) {
  const { data } = await axiosServices.get<ProviderAccountItem<TConfig>>(`${endpoint}/${id}`);
  return data;
}

export async function createProviderAccount<TConfig>(request: ProviderAccountItem<TConfig>) {
  const { data } = await axiosServices.post<ProviderAccountItem<TConfig>>(endpoint, request);
  return data;
}

export async function updateProviderAccount<TConfig>(id: number, request: ProviderAccountItem<TConfig>) {
  const { data } = await axiosServices.put<ProviderAccountItem<TConfig>>(`${endpoint}/${id}`, request);
  return data;
}

export async function deleteProviderAccount(id: number) {
  await axiosServices.delete(`${endpoint}/${id}`);
}

/** Restates the tenant's whole arrangement: every account's id, in the order the grid ended up in. */
export async function reorderProviderAccounts(ids: number[]) {
  await axiosServices.put(`${endpoint}/order`, { ids });
}
