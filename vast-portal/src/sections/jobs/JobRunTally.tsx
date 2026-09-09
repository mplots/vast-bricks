import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';

import type { JobRun } from 'types/job';

/**
 * What a run came to.
 *
 * <p>A tally is codes and numbers on the wire, so each count is worded here and shown as its own chip: a run states
 * several counts and they are read one against another — archived against unchanged against failed — which a
 * sentence of them run together does not let a reader do.
 *
 * <p>A failed run says what it threw instead. That is a diagnostic rather than wording, so it is shown as it came.
 */
export default function JobRunTally({ run }: { run: JobRun }) {
  const intl = useIntl();

  if (run.outcome === 'failed' && run.failure) {
    return (
      <Typography variant="body2" color="error.main" sx={{ overflowWrap: 'anywhere' }}>
        {run.failure}
      </Typography>
    );
  }

  const counts = Object.entries(run.tally ?? {});
  if (counts.length === 0) {
    return null;
  }

  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {counts.map(([name, value]) => (
        <Chip
          key={name}
          size="small"
          variant="outlined"
          color="secondary"
          label={
            <>
              {intl.formatMessage({ id: `job-tally-${name}`, defaultMessage: name })} <strong>{value}</strong>
            </>
          }
        />
      ))}
    </Stack>
  );
}
