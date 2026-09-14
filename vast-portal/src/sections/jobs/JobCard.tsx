import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowDown2, ArrowUp2, Calendar, Clock, Play, Stop } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import Avatar from 'components/@extended/Avatar';
import MainCard from 'components/MainCard';
import type { Job } from 'types/job';
import JobRuns from './JobRuns';
import JobRunTally from './JobRunTally';
import { formatDuration, formatMoment, outcomeColour } from './jobWording';

/**
 * One job: what it is, when it fires, how it last went, and the two things a reader does to it.
 *
 * <p>A card each rather than a row each. The jobs are few and each has a good deal to say — a schedule, a state, a
 * moment, a duration, a tally of counts — and a table of that is a grid read across columns nobody compares one job
 * to another in. What is compared is a job against its own past, which is what the runs underneath are for.
 */
export default function JobCard({
  job,
  busy,
  showingRuns,
  onRun,
  onStop,
  onToggleRuns
}: {
  job: Job;
  busy: boolean;
  showingRuns: boolean;
  onRun: () => void;
  onStop: () => void;
  onToggleRuns: () => void;
}) {
  const intl = useIntl();
  const lastRun = job.lastRun;

  return (
    // Equal height across a row, but nothing inside is stretched to fill it: one card opening its runs makes the
    // row tall, and a neighbour that pushed its buttons to the bottom would strand them under an empty card.
    <MainCard content={false} sx={{ height: '100%' }}>
      <Stack sx={{ p: 2.5, gap: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {/* The state is said by the mark beside the name as well as by the chip: a working job is what a reader
              opens this screen to find, and a spinner is the one thing on a page that says it without being read. */}
          <Avatar type="filled" color={job.running ? 'info' : lastRun ? outcomeColour[lastRun.outcome] : 'secondary'} variant="rounded">
            {job.running ? <CircularProgress size={18} color="inherit" /> : <Clock size={20} />}
          </Avatar>

          <Stack sx={{ gap: 0.5, flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h5">{intl.formatMessage({ id: `job-${job.code}`, defaultMessage: job.code })}</Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" color="text.secondary">
              <Calendar size={14} />
              {/* A job says when it runs in one of three ways: on its own clock, after another job, or only when
                  someone asks. A follower named by its own code would be the one thing on this screen not worded
                  for a reader, so it is named the way its card is titled. */}
              {job.cron ? (
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {job.cron}
                </Typography>
              ) : job.after ? (
                <Typography variant="body2">
                  {intl.formatMessage(
                    { id: 'job-after' },
                    { job: intl.formatMessage({ id: `job-${job.after}`, defaultMessage: job.after }) }
                  )}
                </Typography>
              ) : (
                <Typography variant="body2">{intl.formatMessage({ id: 'job-manual-only' })}</Typography>
              )}
            </Stack>
          </Stack>

          {job.running ? (
            <Chip size="small" variant="light" color="info" label={intl.formatMessage({ id: 'job-outcome-running' })} />
          ) : (
            lastRun && (
              <Chip
                size="small"
                variant="light"
                color={outcomeColour[lastRun.outcome]}
                label={intl.formatMessage({ id: `job-outcome-${lastRun.outcome}` })}
              />
            )
          )}
        </Stack>

        {/* The last run, which is the whole of what a reader wants before deciding to look further back. */}
        <Stack sx={{ gap: 1 }}>
          {lastRun ? (
            <>
              <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" color="text.secondary">
                  {intl.formatMessage({ id: 'job-last-run' })}
                </Typography>
                <Typography variant="subtitle2">{formatMoment(lastRun.startedAt)}</Typography>
                {formatDuration(lastRun) && (
                  <Typography variant="caption" color="text.secondary">
                    {formatDuration(lastRun)}
                  </Typography>
                )}
              </Stack>
              <JobRunTally run={lastRun} />
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {intl.formatMessage({ id: 'job-never-run' })}
            </Typography>
          )}
        </Stack>

        {/* Labelled buttons rather than icons: this is the one screen that does something to the backend rather
            than reading it, and a control that starts a nightly job by hand should say so in a word. */}
        <Stack direction="row" spacing={1} alignItems="center">
          {job.running ? (
            <Button variant="outlined" color="error" size="small" startIcon={<Stop size={16} />} disabled={busy} onClick={onStop}>
              {intl.formatMessage({ id: 'job-cancel' })}
            </Button>
          ) : (
            <Button variant="contained" size="small" startIcon={<Play size={16} />} disabled={busy} onClick={onRun}>
              {intl.formatMessage({ id: 'job-run' })}
            </Button>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="text"
            color="secondary"
            size="small"
            endIcon={showingRuns ? <ArrowUp2 size={14} /> : <ArrowDown2 size={14} />}
            onClick={onToggleRuns}
            aria-expanded={showingRuns}
          >
            {intl.formatMessage({ id: showingRuns ? 'job-hide-runs' : 'job-recent-runs' })}
          </Button>
        </Stack>
      </Stack>

      <Collapse in={showingRuns} unmountOnExit>
        <Divider />
        <JobRuns code={job.code} running={job.running} />
      </Collapse>
    </MainCard>
  );
}
