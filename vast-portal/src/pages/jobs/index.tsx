import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Play, Refresh } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import { runJob, useGetJobs } from 'api/jobs';
import IconButton from 'components/@extended/IconButton';
import MainCard from 'components/MainCard';
import toolButtonSx from 'components/toolButton';
import type { Job, JobOutcome, JobRun } from 'types/job';

/** The chip a run's outcome wears. A job that has never run for this store has no chip at all rather than a grey one. */
const outcomeColour: Record<JobOutcome, 'info' | 'success' | 'error' | 'warning'> = {
  running: 'info',
  succeeded: 'success',
  failed: 'error',
  interrupted: 'warning'
};

/** When a run started, as `dd.mm.yyyy hh:mm`, in the reader's own zone: a job runs where the reader works. */
function formatMoment(value?: string | null) {
  if (!value) return '—';
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value;
  const day = String(at.getDate()).padStart(2, '0');
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const time = at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day}.${month}.${at.getFullYear()} ${time}`;
}

/** How long the run took, where it finished. A job that queries providers is worth knowing the cost of. */
function formatDuration(run: JobRun) {
  if (!run.finishedAt) return null;
  const seconds = Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function JobState({ job }: { job: Job }) {
  const intl = useIntl();

  if (job.running) {
    // No spinner in the chip: the state is one word, and what is moving is said by the button that is busy.
    return <Chip size="small" color="info" variant="light" label={intl.formatMessage({ id: 'job-outcome-running' })} />;
  }

  if (!job.lastRun) {
    return (
      <Typography variant="body2" color="text.secondary">
        {intl.formatMessage({ id: 'job-never-run' })}
      </Typography>
    );
  }

  return (
    <Chip
      size="small"
      variant="light"
      color={outcomeColour[job.lastRun.outcome]}
      label={intl.formatMessage({ id: `job-outcome-${job.lastRun.outcome}` })}
    />
  );
}

/**
 * What the run came to. A tally is codes and numbers on the wire, so each count is worded here; a run that failed
 * says what it threw instead, as the diagnostic it is.
 */
function JobResult({ run }: { run: JobRun | null }) {
  const intl = useIntl();

  if (!run) return <Typography variant="body2">—</Typography>;

  if (run.outcome === 'failed' && run.failure) {
    return (
      <Typography variant="body2" color="error.main" sx={{ overflowWrap: 'anywhere' }}>
        {run.failure}
      </Typography>
    );
  }

  const counts = Object.entries(run.tally ?? {});
  if (counts.length === 0) return <Typography variant="body2">—</Typography>;

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {counts.map(([name, value]) => (
        <Typography key={name} variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {intl.formatMessage({ id: `job-tally-${name}`, defaultMessage: name })}: <strong>{value}</strong>
        </Typography>
      ))}
    </Stack>
  );
}

export default function JobsPage() {
  const intl = useIntl();
  const { jobs, jobsError, jobsLoading, jobsRefreshing, reloadJobs } = useGetJobs();
  const [starting, setStarting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const start = async (code: string) => {
    setStarting(code);
    setActionError(null);
    try {
      await runJob(code);
      await reloadJobs();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : intl.formatMessage({ id: 'job-run-error' }));
    } finally {
      setStarting(null);
    }
  };

  return (
    <Stack spacing={2}>
      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <MainCard
        title={intl.formatMessage({ id: 'jobs' })}
        secondary={
          <Tooltip title={intl.formatMessage({ id: 'jobs-refresh' })}>
            <Box component="span">
              <IconButton
                variant="light"
                color="secondary"
                sx={toolButtonSx}
                disabled={jobsRefreshing}
                onClick={() => reloadJobs()}
                aria-label={intl.formatMessage({ id: 'jobs-refresh' })}
              >
                <Refresh size={18} />
              </IconButton>
            </Box>
          </Tooltip>
        }
        content={false}
      >
        {jobsError && <Alert severity="error">{intl.formatMessage({ id: 'jobs-error' })}</Alert>}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{intl.formatMessage({ id: 'job-name' })}</TableCell>
                <TableCell>{intl.formatMessage({ id: 'job-schedule' })}</TableCell>
                <TableCell>{intl.formatMessage({ id: 'job-state' })}</TableCell>
                <TableCell>{intl.formatMessage({ id: 'job-last-run' })}</TableCell>
                <TableCell>{intl.formatMessage({ id: 'job-result' })}</TableCell>
                <TableCell align="right">{intl.formatMessage({ id: 'job-actions' })}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobsLoading &&
                [0, 1].map((row) => (
                  <TableRow key={row}>
                    <TableCell colSpan={6}>
                      <Skeleton />
                    </TableCell>
                  </TableRow>
                ))}

              {!jobsLoading &&
                (jobs ?? []).map((job) => (
                  <TableRow key={job.code} hover>
                    <TableCell>
                      <Typography variant="subtitle2">{intl.formatMessage({ id: `job-${job.code}`, defaultMessage: job.code })}</Typography>
                    </TableCell>
                    <TableCell>
                      {job.cron ? (
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {job.cron}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {intl.formatMessage({ id: 'job-manual-only' })}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <JobState job={job} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                        {formatMoment(job.lastRun?.startedAt)}
                      </Typography>
                      {job.lastRun && formatDuration(job.lastRun) && (
                        <Typography variant="caption" color="text.secondary">
                          {formatDuration(job.lastRun)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <JobResult run={job.lastRun} />
                    </TableCell>
                    <TableCell align="right">
                      {job.running || starting === job.code ? (
                        <Box
                          component="span"
                          sx={{ display: 'inline-flex', p: 1, color: 'text.secondary' }}
                          aria-label={intl.formatMessage({ id: 'job-outcome-running' })}
                        >
                          <CircularProgress size={18} color="inherit" />
                        </Box>
                      ) : (
                        <Tooltip title={intl.formatMessage({ id: 'job-run' })}>
                          <Box component="span">
                            <IconButton
                              variant="light"
                              color="primary"
                              onClick={() => start(job.code)}
                              aria-label={intl.formatMessage({ id: 'job-run' })}
                            >
                              <Play size={18} />
                            </IconButton>
                          </Box>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

              {!jobsLoading && (jobs ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary">
                      {intl.formatMessage({ id: 'jobs-none' })}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </MainCard>
    </Stack>
  );
}
