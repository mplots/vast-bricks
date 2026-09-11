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

import { createDataSource, getDataSource, updateDataSource } from 'api/dataSources';
import type { StripeDataSourceConfig } from 'types/stripeDataSource';

type Props = {
  /** Data source id to edit, or null to create a new one. */
  dataSourceId: number | null;
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
 * The Stripe data source's own screen, with its own fields: no other provider's form shares this component, and
 * this one shares nothing back - each provider lays out and validates exactly its own fields.
 */
export default function StripeDataSourceDialog({ dataSourceId, open, onClose, onSaved }: Props) {
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
    if (dataSourceId === null) {
      setForm(emptyForm);
      setStoredSecretLength(0);
      return;
    }
    setLoading(true);
    getDataSource<StripeDataSourceConfig>(dataSourceId)
      .then((dataSource) => {
        setForm({ name: dataSource.name, secretKey: '', enabled: dataSource.enabled });
        setStoredSecretLength(dataSource.config.secretKeyLength);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : intl.formatMessage({ id: 'data-sources-error' }));
      })
      .finally(() => setLoading(false));
  }, [open, dataSourceId, intl]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const config: StripeDataSourceConfig = { provider: 'STRIPE', secretKey: form.secretKey, secretKeyLength: 0 };
      if (dataSourceId === null) {
        await createDataSource({ name: form.name, enabled: form.enabled, config });
      } else {
        await updateDataSource(dataSourceId, { name: form.name, enabled: form.enabled, config });
      }
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : intl.formatMessage({ id: 'data-sources-save-error' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {intl.formatMessage({ id: dataSourceId === null ? 'data-sources-stripe-new-title' : 'data-sources-stripe-edit-title' })}
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
              label={intl.formatMessage({ id: 'data-sources-field-name' })}
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              fullWidth
              autoFocus
            />
            <TextField
              label={intl.formatMessage({ id: 'data-sources-field-secret-key' })}
              type="password"
              value={form.secretKey}
              onChange={(event) => setForm((prev) => ({ ...prev, secretKey: event.target.value }))}
              placeholder={
                storedSecretLength > 0 ? '\u2022'.repeat(storedSecretLength) : intl.formatMessage({ id: 'data-sources-secret-unset' })
              }
              helperText={storedSecretLength > 0 ? intl.formatMessage({ id: 'data-sources-secret-keep' }) : undefined}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch checked={form.enabled} onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))} />
              }
              label={intl.formatMessage({ id: 'data-sources-field-enabled' })}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{intl.formatMessage({ id: 'data-sources-cancel' })}</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading || saving || !form.name}>
          {intl.formatMessage({ id: 'data-sources-save' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
