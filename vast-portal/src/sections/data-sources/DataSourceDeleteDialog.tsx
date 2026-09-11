import { useState } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Trash } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import { deleteDataSource } from 'api/dataSources';
import { openSnackbar } from 'api/snackbar';
import Avatar from 'components/@extended/Avatar';
import type { SnackbarProps } from 'types/snackbar';

type Props = {
  dataSourceId: number | null;
  name: string;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
};

/** A data source is a stored credential, not a row to lose to a stray click - confirm before it goes. */
export default function DataSourceDeleteDialog({ dataSourceId, name, open, onClose, onDeleted }: Props) {
  const intl = useIntl();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (dataSourceId === null) {
      return;
    }
    setDeleting(true);
    try {
      await deleteDataSource(dataSourceId);
      openSnackbar({
        open: true,
        message: intl.formatMessage({ id: 'data-sources-deleted' }),
        anchorOrigin: { vertical: 'top', horizontal: 'right' },
        variant: 'alert',
        alert: { color: 'success' }
      } as SnackbarProps);
      onDeleted();
    } catch (error) {
      openSnackbar({
        open: true,
        message: error instanceof Error ? error.message : intl.formatMessage({ id: 'data-sources-delete-error' }),
        anchorOrigin: { vertical: 'top', horizontal: 'right' },
        variant: 'alert',
        alert: { color: 'error' }
      } as SnackbarProps);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent sx={{ mt: 2, my: 1 }}>
        <Stack sx={{ gap: 3.5, alignItems: 'center' }}>
          <Avatar color="error" sx={{ width: 72, height: 72, fontSize: '1.75rem' }}>
            <Trash variant="Bold" />
          </Avatar>
          <Stack sx={{ gap: 2 }}>
            <Typography variant="h4" align="center">
              {intl.formatMessage({ id: 'data-sources-delete-title' })}
            </Typography>
            <Typography align="center">{intl.formatMessage({ id: 'data-sources-delete-body' }, { name })}</Typography>
          </Stack>
          <Stack direction="row" sx={{ gap: 2, width: 1 }}>
            <Button fullWidth onClick={onClose} color="secondary" variant="outlined" disabled={deleting}>
              {intl.formatMessage({ id: 'data-sources-cancel' })}
            </Button>
            <Button fullWidth color="error" variant="contained" onClick={handleDelete} disabled={deleting} autoFocus>
              {intl.formatMessage({ id: 'data-sources-delete' })}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
