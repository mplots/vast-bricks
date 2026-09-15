import { useMemo } from 'react';

import useSWR from 'swr';

import type { JobRun, JobRunsPage, JobsPage } from 'types/job';
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

/**
 * That job's recent runs, newest first.
 *
 * <p>Asked for only once a reader opens them: how a job has been going is worth more than how it is going now, but
 * it is still a second question, and a screen of jobs nobody has opened has no reason to ask it. Polled while the
 * job works, so the run being watched lands in its own history when it ends.
 */
export function useGetJobRuns(code: string | null, running: boolean) {
  const { data, error, isLoading } = useSWR<JobRunsPage>(code ? `${endpoint}/${encodeURIComponent(code)}/runs` : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: running ? 2000 : 0
  });

  return useMemo(
    () => ({
      runs: data?.runs,
      runsError: error,
      runsLoading: isLoading
    }),
    [data, error, isLoading]
  );
}

/**
 * Starts a job for the tenant being served, and returns the run it opened.
 *
 * <p>Whatever the run was asked for goes in the query string, checked by the backend against what the job declares.
 * A run asked for nothing is the ordinary case, and the only one the schedule ever makes.
 */
export async function runJob(code: string, parameters: Record<string, string> = {}) {
  const query = new URLSearchParams(parameters).toString();
  const { data } = await axiosServices.post<JobRun>(`${endpoint}/${encodeURIComponent(code)}/run${query ? `?${query}` : ''}`);
  return data;
}

/**
 * Asks the running job to stop, and returns the run it asked.
 *
 * <p>The run is still going when this answers: stopping a job is asking it to, so the screen goes on watching the
 * same run to see it actually stop.
 */
export async function cancelJob(code: string) {
  const { data } = await axiosServices.post<JobRun>(`${endpoint}/${encodeURIComponent(code)}/cancel`);
  return data;
}
