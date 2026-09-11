import { useMemo } from 'react';

import useSWR from 'swr';

import type { DataSourceItem } from 'types/dataSource';
import axiosServices, { fetcher } from 'utils/axios';

const endpoint = '/api/private/data-sources';

/** Every data source the tenant being served has configured, whatever its provider. */
export function useGetDataSources() {
  const { data, error, isLoading, mutate } = useSWR<DataSourceItem[]>(endpoint, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      dataSources: data,
      dataSourcesError: error,
      dataSourcesLoading: isLoading,
      reloadDataSources: mutate
    }),
    [data, error, isLoading, mutate]
  );
}

export async function getDataSource<TConfig>(id: number) {
  const { data } = await axiosServices.get<DataSourceItem<TConfig>>(`${endpoint}/${id}`);
  return data;
}

export async function createDataSource<TConfig>(request: DataSourceItem<TConfig>) {
  const { data } = await axiosServices.post<DataSourceItem<TConfig>>(endpoint, request);
  return data;
}

export async function updateDataSource<TConfig>(id: number, request: DataSourceItem<TConfig>) {
  const { data } = await axiosServices.put<DataSourceItem<TConfig>>(`${endpoint}/${id}`, request);
  return data;
}

export async function deleteDataSource(id: number) {
  await axiosServices.delete(`${endpoint}/${id}`);
}
