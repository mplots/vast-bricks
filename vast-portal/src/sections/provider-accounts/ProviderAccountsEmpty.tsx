import type { MouseEvent } from 'react';

import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Add } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import ProviderLogo from 'components/logos/ProviderLogo';
import MainCard from 'components/MainCard';
import type { Provider } from 'types/providerAccount';

type Props = {
  /** Every provider that can be added, in the order the add-menu offers them. */
  providers: Provider[];
  onAdd: (event: MouseEvent<HTMLElement>) => void;
};

/**
 * What the screen says before a tenant has configured anything.
 *
 * <p>The illustration is the provider marks themselves, fanned out: a tenant arriving here has no idea what this
 * screen is for, and the logos answer that faster than a sentence does. They are the same marks the cards will
 * carry, so the empty screen is a picture of the full one.
 */
export default function ProviderAccountsEmpty({ providers, onAdd }: Props) {
  const intl = useIntl();
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const middle = (providers.length - 1) / 2;

  return (
    <MainCard content={false}>
      <Stack sx={{ alignItems: 'center', justifyContent: 'center', gap: 3, py: { xs: 5, md: 8 }, px: 2.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            // A soft pool of colour under the fan, so the marks read as an illustration rather than a stray row.
            background: (theme) =>
              `radial-gradient(closest-side, ${alpha(theme.palette.primary.main, 0.14)}, ${alpha(theme.palette.primary.main, 0)})`,
            px: 5,
            py: 3.5
          }}
        >
          {providers.map((provider, index) => (
            <Box
              key={provider}
              sx={{
                // Overlapped just enough to read as one object, and not so far that a mark is hidden behind its neighbour.
                ml: index === 0 ? 0 : -0.75,
                // A shallow fan: each mark tilts away from the middle one, which stays upright.
                transform: `rotate(${(index - middle) * 7}deg) translateY(${Math.abs(index - middle) * 3}px)`,
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.16))'
              }}
            >
              <ProviderLogo provider={provider} size={downMD ? 44 : 60} />
            </Box>
          ))}
        </Box>

        <Stack sx={{ gap: 1, alignItems: 'center', textAlign: 'center' }}>
          <Typography variant={downMD ? 'h3' : 'h2'}>{intl.formatMessage({ id: 'provider-accounts-empty-title' })}</Typography>
          <Typography variant="h5" sx={{ color: 'text.secondary', maxWidth: 480, fontWeight: 400 }}>
            {intl.formatMessage({ id: 'provider-accounts-empty-body' })}
          </Typography>
        </Stack>

        <Button variant="contained" size="large" startIcon={<Add />} onClick={onAdd}>
          {intl.formatMessage({ id: 'provider-accounts-empty-action' })}
        </Button>
      </Stack>
    </MainCard>
  );
}
