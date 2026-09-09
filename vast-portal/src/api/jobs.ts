import { useMemo } from 'react';

import useSWR from 'swr';

import type { JobRun, JobsPage } from 'types/job';
import axiosServices, { fetcher } from 'utils/axios';

const endpoint = '/api/private/jobs';

/**
 * Every job and how it last went, for the tenant being served.
 *
 * <p>Polled only while something is working: a job is started and then watched, and a screen of idle jobs has
 * nothing to ask about until someone asks for a run.
 */
export function useGetJobs() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<JobsPage>(endpoint, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: (latest) => (latest?.jobs?.some((job) => job.running) ? 2000 : 0)
  });

  return useMemo(
    () => ({
      jobs: data?.jobs,
      jobsError: error,
      jobsLoading: isLoading,
      jobsRefreshing: isValidating,
      reloadJobs: mutate
    }),
    [data, error, isLoading, isValidating, mutate]
  );
}

/** Starts a job for the tenant being served, and returns the run it opened. */
export async function runJob(code: string) {
  const { data } = await axiosServices.post<JobRun>(`${endpoint}/${encodeURIComponent(code)}/run`);
  return data;
}
