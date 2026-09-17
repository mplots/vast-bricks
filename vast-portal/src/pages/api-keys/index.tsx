import { useState } from 'react';
import type { ReactNode } from 'react';

import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Add, Trash } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import { useGetApiKeys } from 'api/apiKeys';
import IconButton from 'components/@extended/IconButton';
import MainCard from 'components/MainCard';
import ApiKeyRevokeDialog from 'sections/api-keys/ApiKeyRevokeDialog';
import GenerateApiKeyDialog from 'sections/api-keys/GenerateApiKeyDialog';
import type { ApiKeyItem } from 'types/apiKey';

/** A moment as a row states it, or a dash where there is none - a key nothing has used yet has no last use. */
function moment(value: string | null): string {
  if (!value) {
    return '—';
  }
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) {
    return value;
  }
  const day = String(at.getDate()).padStart(2, '0');
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const time = at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day}.${month}.${at.getFullYear()} ${time}`;
}

/** When a key stops working: the date it expires, that it already has, or that it never will. */
function expiry(apiKey: ApiKeyItem, labels: { never: string; expired: string }): ReactNode {
  if (apiKey.expired) {
    return <Chip size="small" color="error" variant="light" label={labels.expired} />;
  }
  return apiKey.expiresAt ? moment(apiKey.expiresAt) : labels.never;
}

/**
 * The keys this account has generated for the store it is serving: what an external program - the BrickLink
 * extension, BrickSync, anything else calling the API unattended - authenticates with instead of a login.
 *
 * <p>The list can only ever show a key's opening characters. The secret exists in one response, at generation, and
 * is stored nowhere afterwards, so a key that was not copied then is replaced rather than recovered - which is also
 * why the only thing that can be done to a key here is revoke it.
 */
export default function ApiKeysPage() {
  const intl = useIntl();
  const { apiKeys, apiKeysError, apiKeysLoading, reloadApiKeys } = useGetApiKeys();
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState<ApiKeyItem | null>(null);

  if (apiKeysLoading) {
    return (
      <MainCard>
        <Skeleton height={32} />
        <Skeleton height={32} />
      </MainCard>
    );
  }

  if (apiKeysError) {
    return (
      <MainCard>
        <Typography color="error">{intl.formatMessage({ id: 'api-keys-error' })}</Typography>
      </MainCard>
    );
  }

  const keys = apiKeys ?? [];
  const expiryLabels = {
    never: intl.formatMessage({ id: 'api-keys-expiry-never' }),
    expired: intl.formatMessage({ id: 'api-keys-expired' })
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage({ id: 'api-keys-intro' })}
        </Typography>
        <Button variant="contained" startIcon={<Add size={18} />} onClick={() => setGenerating(true)}>
          {intl.formatMessage({ id: 'api-keys-generate' })}
        </Button>
      </Stack>

      <MainCard content={false}>
        {keys.length === 0 ? (
          <Stack spacing={1} sx={{ p: 3, alignItems: 'center' }}>
            <Typography variant="h5">{intl.formatMessage({ id: 'api-keys-empty-title' })}</Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              {intl.formatMessage({ id: 'api-keys-empty-body' })}
            </Typography>
          </Stack>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{intl.formatMessage({ id: 'api-keys-column-name' })}</TableCell>
                  <TableCell>{intl.formatMessage({ id: 'api-keys-column-key' })}</TableCell>
                  <TableCell>{intl.formatMessage({ id: 'api-keys-column-created' })}</TableCell>
                  <TableCell>{intl.formatMessage({ id: 'api-keys-column-last-used' })}</TableCell>
                  <TableCell>{intl.formatMessage({ id: 'api-keys-column-expires' })}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {keys.map((apiKey) => (
                  <TableRow key={apiKey.id} hover>
                    <TableCell>{apiKey.name}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{`${apiKey.tokenPrefix}…`}</TableCell>
                    <TableCell>{moment(apiKey.createdAt)}</TableCell>
                    <TableCell>{moment(apiKey.lastUsedAt)}</TableCell>
                    <TableCell>{expiry(apiKey, expiryLabels)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={intl.formatMessage({ id: 'api-keys-revoke' })}>
                        <IconButton
                          color="error"
                          onClick={() => setRevoking(apiKey)}
                          aria-label={intl.formatMessage({ id: 'api-keys-revoke' })}
                        >
                          <Trash size={18} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </MainCard>

      <GenerateApiKeyDialog open={generating} onClose={() => setGenerating(false)} onGenerated={() => reloadApiKeys()} />
      <ApiKeyRevokeDialog
        apiKeyId={revoking?.id ?? null}
        name={revoking?.name ?? ''}
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onRevoked={async () => {
          setRevoking(null);
          await reloadApiKeys();
        }}
      />
    </Stack>
  );
}
