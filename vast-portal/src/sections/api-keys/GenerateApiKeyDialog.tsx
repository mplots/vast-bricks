import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import copy from 'copy-to-clipboard';
import { Copy, TickCircle } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import { createApiKey } from 'api/apiKeys';
import IconButton from 'components/@extended/IconButton';
import type { GeneratedApiKey } from 'types/apiKey';

type Props = {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
};

/** How long a new key may last. Never is first because a program left running is what most keys are for. */
const EXPIRY_CHOICES = [0, 30, 90, 365];

/**
 * Generates a key and then shows it, in that order, in one dialog.
 *
 * <p>The second step is the whole reason this is a dialog rather than an inline field: the secret exists only in
 * that response, so the screen has to stop and let it be copied before anything can navigate away from it.
 */
export default function GenerateApiKeyDialog({ open, onClose, onGenerated }: Props) {
  const intl = useIntl();
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setName('');
    setExpiresInDays(0);
    setGenerated(null);
    setCopied(false);
    setError(null);
    onClose();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      setGenerated(await createApiKey({ name, expiresInDays }));
      onGenerated();
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : intl.formatMessage({ id: 'api-keys-create-error' }));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generated) {
      return;
    }
    copy(generated.token);
    setCopied(true);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{intl.formatMessage({ id: generated ? 'api-keys-generated-title' : 'api-keys-new-title' })}</DialogTitle>
      <Divider />
      <DialogContent>
        {generated ? (
          <Stack spacing={2}>
            <Alert severity="warning">{intl.formatMessage({ id: 'api-keys-generated-warning' })}</Alert>
            <TextField
              fullWidth
              label={intl.formatMessage({ id: 'api-keys-generated-token' })}
              value={generated.token}
              slotProps={{
                htmlInput: { readOnly: true, spellCheck: false, style: { fontFamily: 'monospace' } },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        color={copied ? 'success' : 'secondary'}
                        onClick={handleCopy}
                        aria-label={intl.formatMessage({ id: 'api-keys-copy' })}
                      >
                        {copied ? <TickCircle size={18} /> : <Copy size={18} />}
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
            />
            <Typography variant="body2" color="text.secondary">
              {intl.formatMessage({ id: 'api-keys-generated-usage' })}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              fullWidth
              autoFocus
              label={intl.formatMessage({ id: 'api-keys-field-name' })}
              helperText={intl.formatMessage({ id: 'api-keys-field-name-hint' })}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              select
              fullWidth
              label={intl.formatMessage({ id: 'api-keys-field-expiry' })}
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(Number(event.target.value))}
            >
              {EXPIRY_CHOICES.map((days) => (
                <MenuItem key={days} value={days}>
                  {days === 0
                    ? intl.formatMessage({ id: 'api-keys-expiry-never' })
                    : intl.formatMessage({ id: 'api-keys-expiry-days' }, { days })}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        )}
      </DialogContent>
      <Divider />
      <DialogActions>
        {generated ? (
          <Button variant="contained" onClick={handleClose} autoFocus>
            {intl.formatMessage({ id: 'api-keys-generated-done' })}
          </Button>
        ) : (
          <>
            <Button color="secondary" onClick={handleClose} disabled={generating}>
              {intl.formatMessage({ id: 'api-keys-cancel' })}
            </Button>
            <Button variant="contained" onClick={handleGenerate} disabled={generating || name.trim() === ''}>
              {intl.formatMessage({ id: 'api-keys-generate' })}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
