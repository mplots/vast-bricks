import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { useIntl } from 'react-intl';

import SecretTextField from './SecretTextField';
import { createProviderAccount, getProviderAccount, updateProviderAccount } from 'api/providerAccounts';
import type { StripeAccountConfig } from 'types/stripeAccount';

type Props = {
  /** Provider account id to edit, or null to create a new one. */
  providerAccountId: number | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  name: string;
  secretKey: string;
  enabled: boolean;
};

const emptyForm: FormState = { name: '', secretKey: '', enabled: true };

/**
 * The Stripe account's own screen, with its own fields: no other provider's form shares this component, and
 * this one shares nothing back - each provider lays out and validates exactly its own fields.
 */
export default function StripeAccountDialog({ providerAccountId, open, onClose, onSaved }: Props) {
  const intl = useIntl();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [storedSecretLength, setStoredSecretLength] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    if (providerAccountId === null) {
      setForm(emptyForm);
      setStoredSecretLength(0);
      return;
    }
    setLoading(true);
    getProviderAccount<StripeAccountConfig>(providerAccountId)
      .then((providerAccount) => {
        setForm({
          name: providerAccount.name,
          secretKey: '',
          enabled: providerAccount.enabled
        });
        setStoredSecretLength(providerAccount.config.secretKeyLength);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : intl.formatMessage({ id: 'provider-accounts-error' }));
      })
      .finally(() => setLoading(false));
  }, [open, providerAccountId, intl]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const config: StripeAccountConfig = { provider: 'STRIPE', secretKey: form.secretKey, secretKeyLength: 0 };
      if (providerAccountId === null) {
        await createProviderAccount({
          name: form.name,
          enabled: form.enabled,
          config
        });
      } else {
        await updateProviderAccount(providerAccountId, {
          name: form.name,
          enabled: form.enabled,
          config
        });
      }
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : intl.formatMessage({ id: 'provider-accounts-save-error' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {intl.formatMessage({
          id: providerAccountId === null ? 'provider-accounts-stripe-new-title' : 'provider-accounts-stripe-edit-title'
        })}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Stack spacing={2}>
            <Skeleton height={56} />
            <Skeleton height={56} />
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label={intl.formatMessage({ id: 'provider-accounts-field-name' })}
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              fullWidth
              autoFocus
            />
            <SecretTextField
              labelId="provider-accounts-field-secret-key"
              value={form.secretKey}
              onChange={(value) => setForm((prev) => ({ ...prev, secretKey: value }))}
              storedLength={storedSecretLength}
            />
            <FormControlLabel
              control={
                <Switch checked={form.enabled} onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))} />
              }
              label={intl.formatMessage({ id: 'provider-accounts-field-enabled' })}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{intl.formatMessage({ id: 'provider-accounts-cancel' })}</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading || saving || !form.name}>
          {intl.formatMessage({ id: 'provider-accounts-save' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
