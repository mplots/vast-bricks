import { useState } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Trash } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import { deleteApiKey } from 'api/apiKeys';
import { openSnackbar } from 'api/snackbar';
import Avatar from 'components/@extended/Avatar';
import type { SnackbarProps } from 'types/snackbar';

type Props = {
  apiKeyId: number | null;
  name: string;
  open: boolean;
  onClose: () => void;
  onRevoked: () => void;
};

/** Revoking stops whatever is using the key mid-run, and nothing can hand the secret back - confirm first. */
export default function ApiKeyRevokeDialog({ apiKeyId, name, open, onClose, onRevoked }: Props) {
  const intl = useIntl();
  const [revoking, setRevoking] = useState(false);

  const handleRevoke = async () => {
    if (apiKeyId === null) {
      return;
    }
    setRevoking(true);
    try {
      await deleteApiKey(apiKeyId);
      openSnackbar({
        open: true,
        message: intl.formatMessage({ id: 'api-keys-revoked' }),
        anchorOrigin: { vertical: 'top', horizontal: 'right' },
        variant: 'alert',
        alert: { color: 'success' }
      } as SnackbarProps);
      onRevoked();
    } catch (error) {
      openSnackbar({
        open: true,
        message: error instanceof Error ? error.message : intl.formatMessage({ id: 'api-keys-revoke-error' }),
        anchorOrigin: { vertical: 'top', horizontal: 'right' },
        variant: 'alert',
        alert: { color: 'error' }
      } as SnackbarProps);
    } finally {
      setRevoking(false);
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
              {intl.formatMessage({ id: 'api-keys-revoke-title' })}
            </Typography>
            <Typography align="center">{intl.formatMessage({ id: 'api-keys-revoke-body' }, { name })}</Typography>
          </Stack>
          <Stack direction="row" sx={{ gap: 2, width: 1 }}>
            <Button fullWidth onClick={onClose} color="secondary" variant="outlined" disabled={revoking}>
              {intl.formatMessage({ id: 'api-keys-cancel' })}
            </Button>
            <Button fullWidth color="error" variant="contained" onClick={handleRevoke} disabled={revoking} autoFocus>
              {intl.formatMessage({ id: 'api-keys-revoke' })}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
