import { useMemo } from 'react';

// third-party
import useSWR, { mutate } from 'swr';

// types
import { MenuProps } from 'types/menu';

const initialState: MenuProps = {
  isDashboardDrawerOpened: false,
  isComponentDrawerOpened: true
};

// ==============================|| API - MENU ||============================== //

const endpoints = {
  key: 'api/menu',
  master: 'master'
};

export function useGetMenuMaster() {
  const { data, isLoading } = useSWR(endpoints.key + endpoints.master, () => initialState, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  const memoizedValue = useMemo(
    () => ({
      menuMaster: data as MenuProps,
      menuMasterLoading: isLoading
    }),
    [data, isLoading]
  );

  return memoizedValue;
}

export function handlerComponentDrawer(isComponentDrawerOpened: boolean) {
  // to update local state based on key

  mutate(
    endpoints.key + endpoints.master,
    (currentMenuMaster: any) => {
      return { ...currentMenuMaster, isComponentDrawerOpened };
    },
    false
  );
}

export function handlerDrawerOpen(isDashboardDrawerOpened: boolean) {
  // to update local state based on key

  mutate(
    endpoints.key + endpoints.master,
    (currentMenuMaster: any) => {
      return { ...currentMenuMaster, isDashboardDrawerOpened };
    },
    false
  );
}
