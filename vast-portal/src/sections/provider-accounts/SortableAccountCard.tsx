import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Edit, HamburgerMenu, Trash } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import IconButton from 'components/@extended/IconButton';
import ProviderLogo from 'components/logos/ProviderLogo';
import MainCard from 'components/MainCard';
import { operatingPeriodLabel } from './operatingPeriodLabel';
import type { ProviderAccountItem } from 'types/providerAccount';

type Props = {
  account: ProviderAccountItem;
  providerLabelId: string;
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * One account's card, as a tile that can be picked up and dropped elsewhere in the grid.
 *
 * <p>Dragging is offered through a handle of its own rather than the whole card, so the edit and delete buttons
 * beside it go on taking plain clicks. The handle also carries the keyboard attributes, which is what lets the
 * grid be rearranged without a pointer at all.
 */
export default function SortableAccountCard({ account, providerLabelId, onEdit, onDelete }: Props) {
  const intl = useIntl();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: account.id!
  });
  const dragLabel = intl.formatMessage({ id: 'provider-accounts-reorder' });

  return (
    <Grid
      ref={setNodeRef}
      size={{ xs: 12, sm: 6, lg: 4 }}
      sx={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : undefined,
        opacity: isDragging ? 0.5 : 1
      }}
    >
      <MainCard>
        <List sx={{ p: 0 }}>
          <ListItem
            disablePadding
            secondaryAction={
              <Stack direction="row" spacing={0.5}>
                <Tooltip title={dragLabel}>
                  <IconButton
                    ref={setActivatorNodeRef}
                    color="secondary"
                    aria-label={dragLabel}
                    sx={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
                    {...attributes}
                    {...listeners}
                  >
                    <HamburgerMenu size={18} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={intl.formatMessage({ id: 'provider-accounts-edit' })}>
                  <IconButton color="secondary" onClick={onEdit} aria-label={intl.formatMessage({ id: 'provider-accounts-edit' })}>
                    <Edit size={18} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={intl.formatMessage({ id: 'provider-accounts-delete' })}>
                  <IconButton color="error" onClick={onDelete} aria-label={intl.formatMessage({ id: 'provider-accounts-delete' })}>
                    <Trash size={18} />
                  </IconButton>
                </Tooltip>
              </Stack>
            }
          >
            <ListItemAvatar>
              <ProviderLogo provider={account.provider ?? 'PAYPAL'} size={40} />
            </ListItemAvatar>
            <ListItemText
              primary={<Typography variant="subtitle1">{account.name}</Typography>}
              secondary={<Typography sx={{ color: 'text.secondary' }}>{intl.formatMessage({ id: providerLabelId })}</Typography>}
            />
          </ListItem>
        </List>
        <Divider sx={{ my: 1.5 }} />
        {/* A card that says nothing about its periods would hide a filter on everything this account reads, so they
            are named here rather than counted: a card saying "2 periods" still has to be opened to be read. */}
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label={intl.formatMessage({ id: account.enabled ? 'provider-accounts-enabled' : 'provider-accounts-disabled' })}
            color={account.enabled ? 'success' : 'default'}
            variant="light"
            size="small"
          />
          {account.operatingPeriods?.map((period, index) => (
            <Chip key={index} label={operatingPeriodLabel(intl, period)} variant="light" size="small" />
          ))}
        </Stack>
      </MainCard>
    </Grid>
  );
}
