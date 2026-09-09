/** How a run ended, or that it has not. */
export type JobOutcome = 'running' | 'succeeded' | 'failed' | 'interrupted';

/** What started a run: the schedule, which fires for every store, or a person, who fires it for their own. */
export type JobTrigger = 'schedule' | 'manual';

export interface JobRun {
  id: number;
  jobCode: string;
  triggeredBy: JobTrigger;
  outcome: JobOutcome;
  startedAt: string;
  finishedAt: string | null;
  /** What the run came to, keyed by the job's own count names. The wording of each is this app's. */
  tally: Record<string, number>;
  /** Why it failed, as the exception stated it. A technical diagnostic rather than wording for a reader. */
  failure: string | null;
}

export interface Job {
  code: string;
  /** The cron it fires on, or null for a job that only runs when someone asks for it. */
  cron: string | null;
  running: boolean;
  lastRun: JobRun | null;
}

export interface JobsPage {
  jobs: Job[];
}
