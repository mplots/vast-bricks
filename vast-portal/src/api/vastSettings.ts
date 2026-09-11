import { useMemo } from 'react';

import useSWR from 'swr';

import type { VastSettingsPage } from 'types/vastSettings';
import axiosServices, { fetcher } from 'utils/axios';

const endpoint = '/api/private/settings/vast';

/** Every database-overridable setting for the tenant being served, grouped by the settings class that declares it. */
export function useGetVastSettings() {
  const { data, error, isLoading, mutate } = useSWR<VastSettingsPage>(endpoint, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(
    () => ({
      settings: data?.settings,
      settingsError: error,
      settingsLoading: isLoading,
      reloadSettings: mutate
    }),
    [data, error, isLoading, mutate]
  );
}

/** Saves the given settings for the tenant being served. A blank value leaves that setting exactly as it was. */
export async function updateVastSettings(values: Record<string, string>) {
  const { data } = await axiosServices.put<VastSettingsPage>(endpoint, { values });
  return data;
}

/** Clears the tenant's override for one setting, falling back to whatever the environment or default provides. */
export async function resetVastSetting(settingKey: string) {
  const { data } = await axiosServices.delete<VastSettingsPage>(`${endpoint}/${encodeURIComponent(settingKey)}`);
  return data;
}
