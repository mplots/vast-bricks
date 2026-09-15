/** How a run ended, or that it has not. */
export type JobOutcome = 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted';

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

/**
 * One thing a run can be asked for on top of what the job does anyway.
 *
 * <p>Declared by the job rather than known to this screen, so a job that gains one is offered without a change
 * here. What it means is the job's own, which is why its wording is keyed by both the job and the parameter.
 */
export interface JobParameter {
  name: string;
  type: 'BOOLEAN';
}

export interface Job {
  code: string;
  /** The cron it fires on, or null for a job that only runs when someone asks for it. */
  cron: string | null;

  /** The code of the job it follows, or null for a job nothing starts on its own. */
  after: string | null;

  /** What a run of it can be asked for, empty for a job that takes nothing. */
  parameters: JobParameter[];
  running: boolean;
  lastRun: JobRun | null;
}

export interface JobsPage {
  jobs: Job[];
}

export interface JobRunsPage {
  runs: JobRun[];
}
