import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Refresh } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import { cancelJob, runJob, useGetJobs } from 'api/jobs';
import IconButton from 'components/@extended/IconButton';
import MainCard from 'components/MainCard';
import toolButtonSx from 'components/toolButton';
import JobCard from 'sections/jobs/JobCard';

/**
 * The jobs screen: one card per registered job, and its own runs underneath when a reader asks for them.
 *
 * <p>Not a table. A table is for rows read against each other, and no one compares one job to another: what is
 * compared is a job against how it went last night, which is the history each card opens.
 */
export default function JobsPage() {
  const intl = useIntl();
  const { jobs, jobsError, jobsLoading, jobsRefreshing, reloadJobs } = useGetJobs();
  const [busy, setBusy] = useState<string | null>(null);
  const [showingRuns, setShowingRuns] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const act = async (code: string, action: (code: string) => Promise<unknown>, errorId: string) => {
    setBusy(code);
    setActionError(null);
    try {
      await action(code);
      await reloadJobs();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : intl.formatMessage({ id: errorId }));
    } finally {
      setBusy(null);
    }
  };

  const toggleRuns = (code: string) =>
    setShowingRuns((shown) => (shown.includes(code) ? shown.filter((one) => one !== code) : [...shown, code]));

  return (
    <Stack spacing={2}>
      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}
      {jobsError && <Alert severity="error">{intl.formatMessage({ id: 'jobs-error' })}</Alert>}

      {/* Only the reload sits above the cards. The page is already headed `Jobs` by the layout and the breadcrumb
          before it, and a third `Jobs` over the cards would name the same thing a third time. */}
      <Stack direction="row" justifyContent="flex-end">
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
      </Stack>

      <Grid container spacing={2.5}>
        {jobsLoading &&
          [0, 1].map((card) => (
            <Grid key={card} size={{ xs: 12, md: 6 }}>
              <MainCard content={false}>
                <Stack sx={{ p: 2.5, gap: 1.5 }}>
                  <Skeleton height={32} width="60%" />
                  <Skeleton height={24} />
                  <Skeleton height={36} width="40%" />
                </Stack>
              </MainCard>
            </Grid>
          ))}

        {!jobsLoading &&
          (jobs ?? []).map((job) => (
            <Grid key={job.code} size={{ xs: 12, md: 6 }}>
              <JobCard
                job={job}
                busy={busy === job.code}
                showingRuns={showingRuns.includes(job.code)}
                onRun={() => act(job.code, runJob, 'job-run-error')}
                onStop={() => act(job.code, cancelJob, 'job-cancel-error')}
                onToggleRuns={() => toggleRuns(job.code)}
              />
            </Grid>
          ))}

        {!jobsLoading && (jobs ?? []).length === 0 && (
          <Grid size={12}>
            <MainCard>
              <Typography variant="body2" color="text.secondary">
                {intl.formatMessage({ id: 'jobs-none' })}
              </Typography>
            </MainCard>
          </Grid>
        )}
      </Grid>
    </Stack>
  );
}
