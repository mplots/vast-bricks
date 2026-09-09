import type { JobOutcome, JobRun } from 'types/job';

/**
 * How a run reads, shared by the card that shows the last one and the timeline that shows the rest.
 *
 * <p>A colour per outcome and nothing else: the wording of an outcome is a message id, and what a run came to is a
 * tally the catalogs word count by count.
 */
export const outcomeColour: Record<JobOutcome, 'info' | 'success' | 'error' | 'warning' | 'secondary'> = {
  running: 'info',
  succeeded: 'success',
  failed: 'error',
  // A run someone stopped is neither a success nor a problem, so it wears neither colour.
  cancelled: 'secondary',
  interrupted: 'warning'
};

/** When a run started, as `dd.mm.yyyy hh:mm`, in the reader's own zone: a job runs where the reader works. */
export function formatMoment(value?: string | null) {
  if (!value) return '—';
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value;
  const day = String(at.getDate()).padStart(2, '0');
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const time = at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day}.${month}.${at.getFullYear()} ${time}`;
}

/** How long the run took, where it finished. A job that queries providers is worth knowing the cost of. */
export function formatDuration(run: JobRun) {
  if (!run.finishedAt) return null;
  const seconds = Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
