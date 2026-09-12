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
import OperatingPeriodsEditor from './OperatingPeriodsEditor';
import { hasOverlappingPeriods } from './operatingPeriodOverlap';
import SecretTextField from './SecretTextField';
import { createProviderAccount, getProviderAccount, updateProviderAccount } from 'api/providerAccounts';
import type { BrickLinkAccountConfig } from 'types/brickLinkAccount';
import type { OperatingPeriod } from 'types/providerAccount';

type Props = {
  /** Provider account id to edit, or null to create a new one. */
  providerAccountId: number | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

/** Where each set of credentials is obtained, so the form can send you straight there rather than describe it. */
const REGISTER_CONSUMER_URL = 'https://www.bricklink.com/v2/api/register_consumer.page';
const BRICKSTORE_ACCESS_URL = 'https://www.bricklink.com/v3/brickstore-access-management.page';

/** The store API's OAuth credentials, in the order BrickLink itself lists them. */
const API_SECRETS = [
  { field: 'consumerKey', labelId: 'provider-accounts-field-consumer-key' },
  { field: 'consumerSecret', labelId: 'provider-accounts-field-consumer-secret' },
  { field: 'tokenValue', labelId: 'provider-accounts-field-token-value' },
  { field: 'tokenSecret', labelId: 'provider-accounts-field-token-secret' }
] as const;

type SecretField = (typeof API_SECRETS)[number]['field'] | 'brickStoreToken';

type Secrets = Record<SecretField, string>;
type Lengths = Record<SecretField, number>;

const emptySecrets: Secrets = { consumerKey: '', consumerSecret: '', tokenValue: '', tokenSecret: '', brickStoreToken: '' };
const noLengths: Lengths = { consumerKey: 0, consumerSecret: 0, tokenValue: 0, tokenSecret: 0, brickStoreToken: 0 };

/**
 * The BrickLink account's own screen. It carries both sets of credentials that reach the same store - the store
 * API's OAuth four, and the session token the store pages are read with - so they are configured together and kept
 * visually apart, because they are obtained in two different places.
 */
export default function BrickLinkAccountDialog({ providerAccountId, open, onClose, onSaved }: Props) {
  const intl = useIntl();
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [operatingPeriods, setOperatingPeriods] = useState<OperatingPeriod[]>([]);
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
      setOperatingPeriods([]);
      setStoredLengths(noLengths);
      return;
    }
    setLoading(true);
    getProviderAccount<BrickLinkAccountConfig>(providerAccountId)
      .then((providerAccount) => {
        const config = providerAccount.config;
        setName(providerAccount.name);
        setEnabled(providerAccount.enabled);
        setOperatingPeriods(providerAccount.operatingPeriods ?? []);
        setStoredLengths({
          consumerKey: config.consumerKeyLength,
          consumerSecret: config.consumerSecretLength,
          tokenValue: config.tokenValueLength,
          tokenSecret: config.tokenSecretLength,
          brickStoreToken: config.brickStoreTokenLength
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
      const config: BrickLinkAccountConfig = {
        provider: 'BRICK_LINK',
        ...secrets,
        consumerKeyLength: 0,
        consumerSecretLength: 0,
        tokenValueLength: 0,
        tokenSecretLength: 0,
        brickStoreTokenLength: 0
      };
      if (providerAccountId === null) {
        await createProviderAccount({ name, enabled, operatingPeriods, config });
      } else {
        await updateProviderAccount(providerAccountId, { name, enabled, operatingPeriods, config });
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
          id: providerAccountId === null ? 'provider-accounts-bricklink-new-title' : 'provider-accounts-bricklink-edit-title'
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
            <CredentialSectionHeader
              titleId="provider-accounts-bricklink-api-section"
              link={{ labelId: 'provider-accounts-bricklink-api-link', href: REGISTER_CONSUMER_URL }}
            />
            {API_SECRETS.map((secret) => (
              <SecretTextField
                key={secret.field}
                labelId={secret.labelId}
                value={secrets[secret.field]}
                onChange={(value) => setSecret(secret.field, value)}
                storedLength={storedLengths[secret.field]}
              />
            ))}
            <CredentialSectionHeader
              titleId="provider-accounts-bricklink-store-section"
              link={{ labelId: 'provider-accounts-bricklink-store-link', href: BRICKSTORE_ACCESS_URL }}
            />
            <SecretTextField
              labelId="provider-accounts-field-brickstore-token"
              value={secrets.brickStoreToken}
              onChange={(value) => setSecret('brickStoreToken', value)}
              storedLength={storedLengths.brickStoreToken}
            />
            <OperatingPeriodsEditor value={operatingPeriods} onChange={setOperatingPeriods} />
            <FormControlLabel
              control={<Switch checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />}
              label={intl.formatMessage({ id: 'provider-accounts-field-enabled' })}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{intl.formatMessage({ id: 'provider-accounts-cancel' })}</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading || saving || !name || hasOverlappingPeriods(operatingPeriods)}>
          {intl.formatMessage({ id: 'provider-accounts-save' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
