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

import OperatingPeriodsEditor from './OperatingPeriodsEditor';
import { hasOverlappingPeriods } from './operatingPeriodOverlap';
import SecretTextField from './SecretTextField';
import { createProviderAccount, getProviderAccount, updateProviderAccount } from 'api/providerAccounts';
import type { BrickOwlAccountConfig } from 'types/brickOwlAccount';
import type { OperatingPeriod } from 'types/providerAccount';

type Props = {
  /** Provider account id to edit, or null to create a new one. */
  providerAccountId: number | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = { name: string; apiKey: string; operatingPeriods: OperatingPeriod[]; enabled: boolean };

const emptyForm: FormState = { name: '', apiKey: '', operatingPeriods: [], enabled: true };

/**
 * The BrickOwl account's own screen, with its own fields: no other provider's form shares this component, and this
 * one shares nothing back - each provider lays out and validates exactly its own fields.
 */
export default function BrickOwlAccountDialog({ providerAccountId, open, onClose, onSaved }: Props) {
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
    getProviderAccount<BrickOwlAccountConfig>(providerAccountId)
      .then((providerAccount) => {
        setForm({
          name: providerAccount.name,
          apiKey: '',
          operatingPeriods: providerAccount.operatingPeriods ?? [],
          enabled: providerAccount.enabled
        });
        setStoredSecretLength(providerAccount.config.apiKeyLength);
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
      const config: BrickOwlAccountConfig = { provider: 'BRICK_OWL', apiKey: form.apiKey, apiKeyLength: 0 };
      if (providerAccountId === null) {
        await createProviderAccount({
          name: form.name,
          enabled: form.enabled,
          operatingPeriods: form.operatingPeriods,
          config
        });
      } else {
        await updateProviderAccount(providerAccountId, {
          name: form.name,
          enabled: form.enabled,
          operatingPeriods: form.operatingPeriods,
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
          id: providerAccountId === null ? 'provider-accounts-brickowl-new-title' : 'provider-accounts-brickowl-edit-title'
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
              labelId="provider-accounts-field-api-key"
              value={form.apiKey}
              onChange={(value) => setForm((prev) => ({ ...prev, apiKey: value }))}
              storedLength={storedSecretLength}
            />
            <OperatingPeriodsEditor
              value={form.operatingPeriods}
              onChange={(operatingPeriods) => setForm((prev) => ({ ...prev, operatingPeriods }))}
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
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || saving || !form.name || hasOverlappingPeriods(form.operatingPeriods)}
        >
          {intl.formatMessage({ id: 'provider-accounts-save' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
