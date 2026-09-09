import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Timeline from '@mui/lab/Timeline';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';

import { useGetJobRuns } from 'api/jobs';
import JobRunTally from './JobRunTally';
import { formatDuration, formatMoment, outcomeColour } from './jobWording';

/**
 * How a job has been going, newest first.
 *
 * <p>A timeline rather than a table: runs of one job are the same few facts over and over, and what a reader is
 * after is the shape of them down time — a run that failed among the ones that did not, a nightly job that skipped
 * a night. A dot per run says which was which without a column headed for it.
 *
 * <p>The dot alone never carries the outcome: every run states it in words beside the moment it started.
 */
export default function JobRuns({ code, running }: { code: string; running: boolean }) {
  const intl = useIntl();
  const { runs, runsError, runsLoading } = useGetJobRuns(code, running);

  if (runsLoading) {
    return (
      <Stack spacing={1} sx={{ px: 2.5, pb: 2 }}>
        <Skeleton height={28} />
        <Skeleton height={28} />
      </Stack>
    );
  }

  if (runsError) {
    return (
      <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>
        {intl.formatMessage({ id: 'job-runs-error' })}
      </Alert>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pb: 2 }}>
        {intl.formatMessage({ id: 'job-runs-none' })}
      </Typography>
    );
  }

  return (
    <Timeline
      position="right"
      sx={{
        m: 0,
        px: 2.5,
        pt: 0,
        pb: 1.5,
        // The opposite side is what pushes a right-positioned timeline off centre, and nothing is written there.
        '& .MuiTimelineItem-root:before': { display: 'none' },
        '& .MuiTimelineItem-root': { minHeight: 62 },
        '& .MuiTimelineDot-root': { boxShadow: 'none', m: 0, mt: 0.75, p: 0.5 },
        '& .MuiTimelineConnector-root': { border: '1px dashed', borderColor: 'divider', bgcolor: 'transparent' },
        '& .MuiTimelineContent-root': { pt: 0, pb: 1.5 }
      }}
    >
      {runs.map((run, index) => (
        <TimelineItem key={run.id}>
          <TimelineSeparator>
            <TimelineDot color={outcomeColour[run.outcome]} variant={run.outcome === 'running' ? 'outlined' : 'filled'} />
            {index < runs.length - 1 && <TimelineConnector />}
          </TimelineSeparator>
          <TimelineContent>
            <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle2">{intl.formatMessage({ id: `job-outcome-${run.outcome}` })}</Typography>
              <Typography variant="body2" color="text.secondary">
                {formatMoment(run.startedAt)}
              </Typography>
              {formatDuration(run) && (
                <Typography variant="caption" color="text.secondary">
                  {formatDuration(run)}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {intl.formatMessage({ id: `job-trigger-${run.triggeredBy}` })}
              </Typography>
            </Stack>
            <JobRunTally run={run} />
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );
}
