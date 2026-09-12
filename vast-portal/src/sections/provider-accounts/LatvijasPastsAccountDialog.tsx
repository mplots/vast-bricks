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

import CredentialSectionHeader from './CredentialSectionHeader';
import SecretTextField from './SecretTextField';
import { createProviderAccount, getProviderAccount, updateProviderAccount } from 'api/providerAccounts';
import type { LatvijasPastsAccountConfig } from 'types/latvijasPastsAccount';

type Props = {
  /** Provider account id to edit, or null to create a new one. */
  providerAccountId: number | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type SecretField = 'apiUser' | 'apiKey' | 'username' | 'password';

type Secrets = Record<SecretField, string>;
type Lengths = Record<SecretField, number>;

const emptySecrets: Secrets = { apiUser: '', apiKey: '', username: '', password: '' };
const noLengths: Lengths = { apiUser: 0, apiKey: 0, username: 0, password: 0 };

/**
 * The Latvijas Pasts account's own screen: the shipping API's credentials, and the self-service sign-in used for
 * the register the API does not expose. Both reach one postal account, so they are kept apart on the form rather
 * than in two provider accounts.
 */
export default function LatvijasPastsAccountDialog({ providerAccountId, open, onClose, onSaved }: Props) {
  const intl = useIntl();
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [secrets, setSecrets] = useState<Secrets>(emptySecrets);
  const [storedLengths, setStoredLengths] = useState<Lengths>(noLengths);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    setSecrets(emptySecrets);
    if (providerAccountId === null) {
      setName('');
      setEnabled(true);
      setStoredLengths(noLengths);
      return;
    }
    setLoading(true);
    getProviderAccount<LatvijasPastsAccountConfig>(providerAccountId)
      .then((providerAccount) => {
        const config = providerAccount.config;
        setName(providerAccount.name);
        setEnabled(providerAccount.enabled);
        setStoredLengths({
          apiUser: config.apiUserLength,
          apiKey: config.apiKeyLength,
          username: config.usernameLength,
          password: config.passwordLength
        });
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : intl.formatMessage({ id: 'provider-accounts-error' }));
      })
      .finally(() => setLoading(false));
  }, [open, providerAccountId, intl]);

  const setSecret = (field: SecretField, value: string) => setSecrets((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const config: LatvijasPastsAccountConfig = {
        provider: 'LATVIJAS_PASTS',
        ...secrets,
        apiUserLength: 0,
        apiKeyLength: 0,
        usernameLength: 0,
        passwordLength: 0
      };
      if (providerAccountId === null) {
        await createProviderAccount({ name, enabled, config });
      } else {
        await updateProviderAccount(providerAccountId, { name, enabled, config });
      }
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : intl.formatMessage({ id: 'provider-accounts-save-error' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {intl.formatMessage({
          id: providerAccountId === null ? 'provider-accounts-latvijaspasts-new-title' : 'provider-accounts-latvijaspasts-edit-title'
        })}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Stack spacing={2}>
            <Skeleton height={56} />
            <Skeleton height={56} />
            <Skeleton height={56} />
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label={intl.formatMessage({ id: 'provider-accounts-field-name' })}
              value={name}
              onChange={(event) => setName(event.target.value)}
              fullWidth
              autoFocus
            />
            <CredentialSectionHeader titleId="provider-accounts-latvijaspasts-api-section" />
            <SecretTextField
              labelId="provider-accounts-field-api-user"
              value={secrets.apiUser}
              onChange={(value) => setSecret('apiUser', value)}
              storedLength={storedLengths.apiUser}
            />
            <SecretTextField
              labelId="provider-accounts-field-api-key"
              value={secrets.apiKey}
              onChange={(value) => setSecret('apiKey', value)}
              storedLength={storedLengths.apiKey}
            />
            <CredentialSectionHeader titleId="provider-accounts-latvijaspasts-signin-section" />
            <SecretTextField
              labelId="provider-accounts-field-username"
              value={secrets.username}
              onChange={(value) => setSecret('username', value)}
              storedLength={storedLengths.username}
            />
            <SecretTextField
              labelId="provider-accounts-field-password"
              value={secrets.password}
              onChange={(value) => setSecret('password', value)}
              storedLength={storedLengths.password}
            />
            <FormControlLabel
              control={<Switch checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />}
              label={intl.formatMessage({ id: 'provider-accounts-field-enabled' })}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{intl.formatMessage({ id: 'provider-accounts-cancel' })}</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading || saving || !name}>
          {intl.formatMessage({ id: 'provider-accounts-save' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
