import { useMemo } from 'react';

import useSWR from 'swr';

import type { ApiKeyItem, CreateApiKeyRequest, GeneratedApiKey } from 'types/apiKey';
import axiosServices, { fetcher } from 'utils/axios';

const endpoint = '/api/private/account/api-keys';

/** The signed-in account's own keys for the store being served. A tenant switch shows a different list. */
export function useGetApiKeys() {
  const { data, error, isLoading, mutate } = useSWR<ApiKeyItem[]>(endpoint, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      apiKeys: data,
      apiKeysError: error,
      apiKeysLoading: isLoading,
      reloadApiKeys: mutate
    }),
    [data, error, isLoading, mutate]
  );
}

/** Generates a key and returns it with its secret - the only response that carries one. */
export async function createApiKey(request: CreateApiKeyRequest) {
  const { data } = await axiosServices.post<GeneratedApiKey>(endpoint, request);
  return data;
}

/** Revokes a key outright. There is no undo: its secret was never stored, so it can only be replaced. */
export async function deleteApiKey(id: number) {
  await axiosServices.delete(`${endpoint}/${id}`);
}
