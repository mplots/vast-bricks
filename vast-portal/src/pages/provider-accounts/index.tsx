import { useState } from 'react';

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import Alert from '@mui/material/Alert';
import Fab from '@mui/material/Fab';
import Grid from '@mui/material/Grid';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Add } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import { reorderProviderAccounts, useGetProviderAccounts } from 'api/providerAccounts';
import ProviderLogo from 'components/logos/ProviderLogo';
import MainCard from 'components/MainCard';
import BrickLinkAccountDialog from 'sections/provider-accounts/BrickLinkAccountDialog';
import BrickOwlAccountDialog from 'sections/provider-accounts/BrickOwlAccountDialog';
import LatvijasPastsAccountDialog from 'sections/provider-accounts/LatvijasPastsAccountDialog';
import ManaKabataAccountDialog from 'sections/provider-accounts/ManaKabataAccountDialog';
import ProviderAccountDeleteDialog from 'sections/provider-accounts/ProviderAccountDeleteDialog';
import ProviderAccountsEmpty from 'sections/provider-accounts/ProviderAccountsEmpty';
import SortableAccountCard from 'sections/provider-accounts/SortableAccountCard';
import PayPalAccountDialog from 'sections/provider-accounts/PayPalAccountDialog';
import StripeAccountDialog from 'sections/provider-accounts/StripeAccountDialog';
import type { ProviderAccountItem, Provider } from 'types/providerAccount';

type ActiveDialog = { provider: Provider; id: number | null };

/** Each provider's name as its own brand writes it. The add-menu and the row both read it from here, so a provider
 * is never shown as the enum constant it is stored as. */
const PROVIDER_LABELS: Record<Provider, string> = {
  BRICK_LINK: 'provider-accounts-provider-bricklink',
  BRICK_OWL: 'provider-accounts-provider-brickowl',
  LATVIJAS_PASTS: 'provider-accounts-provider-latvijaspasts',
  MANA_KABATA: 'provider-accounts-provider-manakabata',
  PAYPAL: 'provider-accounts-provider-paypal',
  STRIPE: 'provider-accounts-provider-stripe'
};

/** Every provider offered from the add-menu, in the order it is offered. */
const PROVIDERS: Provider[] = ['BRICK_LINK', 'BRICK_OWL', 'LATVIJAS_PASTS', 'MANA_KABATA', 'PAYPAL', 'STRIPE'];

/** The providers a tenant can hold more than one account with - the payment gateways, and only them. Every other
 * provider is a party dealt with once, and the server refuses a second account with it. */
const MULTIPLE_ACCOUNT_PROVIDERS: Provider[] = ['PAYPAL', 'STRIPE'];

/**
 * The provider accounts screen: every account a tenant has configured, whatever the provider.
 *
 * <p>This list itself knows nothing about any one provider's fields - it shows the row and routes to that
 * provider's own dialog to create or edit one. A single round add button opens a picker of every provider so the
 * toolbar stays one button no matter how many providers exist; adding one means adding its logo, one entry in
 * {@code PROVIDERS} and {@code PROVIDER_LABELS}, and its own dialog branch here, never a change to how an existing
 * provider's row renders.
 */
export default function ProviderAccountsPage() {
  const intl = useIntl();
  const { providerAccounts, providerAccountsError, providerAccountsLoading, reloadProviderAccounts } = useGetProviderAccounts();
  const [activeDialog, setActiveDialog] = useState<ActiveDialog | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<ProviderAccountItem | null>(null);
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  // A small drag threshold, so a press that never moves stays a click for the buttons on the handle's own row.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const accounts = providerAccounts ?? [];

  /**
   * Moves the dropped card and saves the whole arrangement. The grid shows the new order at once and SWR puts the
   * old one back if the save is refused, so the screen never claims an arrangement the database did not take.
   */
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const from = accounts.findIndex((account) => account.id === active.id);
    const to = accounts.findIndex((account) => account.id === over.id);
    if (from < 0 || to < 0) {
      return;
    }

    const rearranged = arrayMove(accounts, from, to);
    setReorderError(null);
    try {
      await reloadProviderAccounts(
        async () => {
          await reorderProviderAccounts(rearranged.map((account) => account.id!));
          return rearranged;
        },
        { optimisticData: rearranged, rollbackOnError: true, revalidate: true }
      );
    } catch {
      setReorderError(intl.formatMessage({ id: 'provider-accounts-reorder-error' }));
    }
  };

  /** Whether the add-menu still offers this provider: one already configured is offered again only by a gateway. */
  const canAdd = (provider: Provider) =>
    MULTIPLE_ACCOUNT_PROVIDERS.includes(provider) || !accounts.some((account) => account.provider === provider);

  const closeDialog = () => setActiveDialog(null);
  const closeAddMenu = () => setAddMenuAnchor(null);

  const handleSaved = async () => {
    closeDialog();
    await reloadProviderAccounts();
  };

  const handleDeleted = async () => {
    setDeletingAccount(null);
    await reloadProviderAccounts();
  };

  if (providerAccountsLoading) {
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

  if (providerAccountsError) {
    return (
      <MainCard>
        <Typography color="error">{intl.formatMessage({ id: 'provider-accounts-error' })}</Typography>
      </MainCard>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" justifyContent="flex-end">
        <Tooltip title={intl.formatMessage({ id: 'provider-accounts-add' })}>
          <Fab
            size="medium"
            color="primary"
            aria-label={intl.formatMessage({ id: 'provider-accounts-add' })}
            onClick={(event) => setAddMenuAnchor(event.currentTarget)}
          >
            <Add size={22} />
          </Fab>
        </Tooltip>
      </Stack>

      <Menu anchorEl={addMenuAnchor} open={addMenuAnchor !== null} onClose={closeAddMenu}>
        {PROVIDERS.map((provider) => (
          <MenuItem
            key={provider}
            disabled={!canAdd(provider)}
            onClick={() => {
              setActiveDialog({ provider, id: null });
              closeAddMenu();
            }}
          >
            <ListItemIcon>
              <ProviderLogo provider={provider} size={24} />
            </ListItemIcon>
            <ListItemText
              primary={intl.formatMessage({ id: PROVIDER_LABELS[provider] })}
              secondary={canAdd(provider) ? undefined : intl.formatMessage({ id: 'provider-accounts-already-configured' })}
            />
          </MenuItem>
        ))}
      </Menu>

      {reorderError && <Alert severity="error">{reorderError}</Alert>}

      {accounts.length === 0 ? (
        <ProviderAccountsEmpty providers={PROVIDERS} onAdd={(event) => setAddMenuAnchor(event.currentTarget)} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={accounts.map((account) => account.id!)} strategy={rectSortingStrategy}>
            <Grid container spacing={2.5}>
              {accounts.map((providerAccount) => (
                <SortableAccountCard
                  key={providerAccount.id}
                  account={providerAccount}
                  providerLabelId={PROVIDER_LABELS[providerAccount.provider ?? 'PAYPAL']}
                  onEdit={() => setActiveDialog({ provider: providerAccount.provider!, id: providerAccount.id! })}
                  onDelete={() => setDeletingAccount(providerAccount)}
                />
              ))}
            </Grid>
          </SortableContext>
        </DndContext>
      )}

      <BrickLinkAccountDialog
        providerAccountId={activeDialog?.provider === 'BRICK_LINK' ? activeDialog.id : null}
        open={activeDialog?.provider === 'BRICK_LINK'}
        onClose={closeDialog}
        onSaved={handleSaved}
      />
      <BrickOwlAccountDialog
        providerAccountId={activeDialog?.provider === 'BRICK_OWL' ? activeDialog.id : null}
        open={activeDialog?.provider === 'BRICK_OWL'}
        onClose={closeDialog}
        onSaved={handleSaved}
      />
      <LatvijasPastsAccountDialog
        providerAccountId={activeDialog?.provider === 'LATVIJAS_PASTS' ? activeDialog.id : null}
        open={activeDialog?.provider === 'LATVIJAS_PASTS'}
        onClose={closeDialog}
        onSaved={handleSaved}
      />
      <ManaKabataAccountDialog
        providerAccountId={activeDialog?.provider === 'MANA_KABATA' ? activeDialog.id : null}
        open={activeDialog?.provider === 'MANA_KABATA'}
        onClose={closeDialog}
        onSaved={handleSaved}
      />
      <PayPalAccountDialog
        providerAccountId={activeDialog?.provider === 'PAYPAL' ? activeDialog.id : null}
        open={activeDialog?.provider === 'PAYPAL'}
        onClose={closeDialog}
        onSaved={handleSaved}
      />
      <StripeAccountDialog
        providerAccountId={activeDialog?.provider === 'STRIPE' ? activeDialog.id : null}
        open={activeDialog?.provider === 'STRIPE'}
        onClose={closeDialog}
        onSaved={handleSaved}
      />
      <ProviderAccountDeleteDialog
        providerAccountId={deletingAccount?.id ?? null}
        name={deletingAccount?.name ?? ''}
        open={deletingAccount !== null}
        onClose={() => setDeletingAccount(null)}
        onDeleted={handleDeleted}
      />
    </Stack>
  );
}
