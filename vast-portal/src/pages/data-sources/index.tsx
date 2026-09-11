import { useState } from 'react';

import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Fab from '@mui/material/Fab';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Add, Edit, Trash } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import { useGetDataSources } from 'api/dataSources';
import IconButton from 'components/@extended/IconButton';
import ProviderLogo from 'components/logos/ProviderLogo';
import MainCard from 'components/MainCard';
import DataSourceDeleteDialog from 'sections/data-sources/DataSourceDeleteDialog';
import PayPalDataSourceDialog from 'sections/data-sources/PayPalDataSourceDialog';
import StripeDataSourceDialog from 'sections/data-sources/StripeDataSourceDialog';
import type { DataSourceItem, DataSourceProvider } from 'types/dataSource';

type ActiveDialog = { provider: DataSourceProvider; id: number | null };

/** Every provider offered from the add-menu. Adding one here is the only change a new provider needs on this page. */
const PROVIDERS: { provider: DataSourceProvider; labelId: string }[] = [
  { provider: 'PAYPAL', labelId: 'data-sources-add-paypal' },
  { provider: 'STRIPE', labelId: 'data-sources-add-stripe' }
];

/**
 * The data sources screen: every provider account a tenant has configured, whatever the provider.
 *
 * <p>This list itself knows nothing about any one provider's fields - it shows the row and routes to that
 * provider's own dialog to create or edit one. A single round add button opens a picker of every provider so the
 * toolbar stays one button no matter how many providers exist; adding one means adding its logo, one entry in
 * {@code PROVIDERS}, and its own dialog branch here, never a change to how an existing provider's row renders.
 */
export default function DataSourcesPage() {
  const intl = useIntl();
  const { dataSources, dataSourcesError, dataSourcesLoading, reloadDataSources } = useGetDataSources();
  const [activeDialog, setActiveDialog] = useState<ActiveDialog | null>(null);
  const [deletingSource, setDeletingSource] = useState<DataSourceItem | null>(null);
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);

  const closeDialog = () => setActiveDialog(null);
  const closeAddMenu = () => setAddMenuAnchor(null);

  const handleSaved = async () => {
    closeDialog();
    await reloadDataSources();
  };

  const handleDeleted = async () => {
    setDeletingSource(null);
    await reloadDataSources();
  };

  if (dataSourcesLoading) {
    return (
      <Grid container spacing={2.5}>
        {[0, 1].map((card) => (
          <Grid key={card} size={{ xs: 12, sm: 6, lg: 4 }}>
            <MainCard>
              <Skeleton variant="circular" width={40} height={40} sx={{ mb: 1.5 }} />
              <Skeleton height={24} width="60%" />
              <Skeleton height={20} width="40%" />
            </MainCard>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (dataSourcesError) {
    return (
      <MainCard>
        <Typography color="error">{intl.formatMessage({ id: 'data-sources-error' })}</Typography>
      </MainCard>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" justifyContent="flex-end">
        <Tooltip title={intl.formatMessage({ id: 'data-sources-add' })}>
          <Fab
            size="medium"
            color="primary"
            aria-label={intl.formatMessage({ id: 'data-sources-add' })}
            onClick={(event) => setAddMenuAnchor(event.currentTarget)}
          >
            <Add size={22} />
          </Fab>
        </Tooltip>
      </Stack>

      <Menu anchorEl={addMenuAnchor} open={addMenuAnchor !== null} onClose={closeAddMenu}>
        {PROVIDERS.map(({ provider, labelId }) => (
          <MenuItem
            key={provider}
            onClick={() => {
              setActiveDialog({ provider, id: null });
              closeAddMenu();
            }}
          >
            <ListItemIcon>
              <ProviderLogo provider={provider} size={24} />
            </ListItemIcon>
            <ListItemText>{intl.formatMessage({ id: labelId })}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <Grid container spacing={2.5}>
        {(dataSources ?? []).map((dataSource) => (
          <Grid key={dataSource.id} size={{ xs: 12, sm: 6, lg: 4 }}>
            <MainCard>
              <List sx={{ p: 0 }}>
                <ListItem
                  disablePadding
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title={intl.formatMessage({ id: 'data-sources-edit' })}>
                        <IconButton
                          color="secondary"
                          onClick={() => setActiveDialog({ provider: dataSource.provider!, id: dataSource.id! })}
                          aria-label={intl.formatMessage({ id: 'data-sources-edit' })}
                        >
                          <Edit size={18} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={intl.formatMessage({ id: 'data-sources-delete' })}>
                        <IconButton
                          color="error"
                          onClick={() => setDeletingSource(dataSource)}
                          aria-label={intl.formatMessage({ id: 'data-sources-delete' })}
                        >
                          <Trash size={18} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  }
                >
                  <ListItemAvatar>
                    <ProviderLogo provider={dataSource.provider ?? 'PAYPAL'} size={40} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Typography variant="subtitle1">{dataSource.name}</Typography>}
                    secondary={<Typography sx={{ color: 'text.secondary' }}>{dataSource.provider}</Typography>}
                  />
                </ListItem>
              </List>
              <Divider sx={{ my: 1.5 }} />
              <Chip
                label={intl.formatMessage({ id: dataSource.enabled ? 'data-sources-enabled' : 'data-sources-disabled' })}
                color={dataSource.enabled ? 'success' : 'default'}
                variant="light"
                size="small"
              />
            </MainCard>
          </Grid>
        ))}

        {(dataSources ?? []).length === 0 && (
          <Grid size={12}>
            <MainCard>
              <Typography variant="body2" color="text.secondary">
                {intl.formatMessage({ id: 'data-sources-none' })}
              </Typography>
            </MainCard>
          </Grid>
        )}
      </Grid>

      <PayPalDataSourceDialog
        dataSourceId={activeDialog?.provider === 'PAYPAL' ? activeDialog.id : null}
        open={activeDialog?.provider === 'PAYPAL'}
        onClose={closeDialog}
        onSaved={handleSaved}
      />
      <StripeDataSourceDialog
        dataSourceId={activeDialog?.provider === 'STRIPE' ? activeDialog.id : null}
        open={activeDialog?.provider === 'STRIPE'}
        onClose={closeDialog}
        onSaved={handleSaved}
      />
      <DataSourceDeleteDialog
        dataSourceId={deletingSource?.id ?? null}
        name={deletingSource?.name ?? ''}
        open={deletingSource !== null}
        onClose={() => setDeletingSource(null)}
        onDeleted={handleDeleted}
      />
    </Stack>
  );
}
