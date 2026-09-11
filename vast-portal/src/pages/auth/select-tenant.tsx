import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project-imports
import Avatar from 'components/@extended/Avatar';
import Logo from 'components/logo';
import MainCard from 'components/MainCard';
import AuthWrapper from 'sections/auth/AuthWrapper';
import { APP_DEFAULT_PATH } from 'config';
import useAuth from 'hooks/useAuth';
import type { ColorProps } from 'types/extended';
import type { TenantSummary } from 'types/auth';

// A calm subset of the theme's palette - no error/warning red-orange, which would read as a warning here rather
// than as one tile among several equally valid choices.
const AVATAR_COLORS: ColorProps[] = ['primary', 'secondary', 'info', 'success'];

function avatarColor(code: string): ColorProps {
  const hash = Array.from(code).reduce((total, character) => total + character.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0][0], words[1][0]] : [words[0]?.[0] ?? '?'];
  return letters.join('').toUpperCase();
}

function TenantTile({
  candidate,
  current,
  busy,
  disabled,
  onSelect
}: {
  candidate: TenantSummary;
  current: boolean;
  busy: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <MainCard
      onClick={disabled ? undefined : onSelect}
      contentSX={{ p: 2 }}
      sx={(theme) => ({
        borderColor: current ? 'primary.main' : 'divider',
        ...(current && { bgcolor: 'primary.lighter' }),
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled && !busy ? 0.5 : 1,
        transition: 'opacity 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        ...(!disabled && { '&:hover': { boxShadow: theme.customShadows.primary } })
      })}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Avatar type="filled" color={avatarColor(candidate.code)}>
          {initials(candidate.name)}
        </Avatar>
        <Stack sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap>
            {candidate.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {candidate.code}
          </Typography>
        </Stack>
        {busy && <CircularProgress size={20} />}
        {!busy && current && <Chip label="Current" size="small" color="primary" variant="light" />}
      </Stack>
    </MainCard>
  );
}

// ============================|| SELECT TENANT ||============================ //

/** The mandatory step between a login and the dashboard for an account that serves more than one tenant. */
export default function SelectTenant() {
  const { tenant, tenants, switchTenant } = useAuth();
  const navigate = useNavigate();
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (code: string) => {
    setBusyCode(code);
    setError(null);
    try {
      await switchTenant(code);
      navigate(APP_DEFAULT_PATH, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The tenant could not be selected.');
      setBusyCode(null);
    }
  };

  return (
    <AuthWrapper>
      <Grid container spacing={3}>
        <Grid sx={{ textAlign: 'center' }} size={12}>
          <Logo />
        </Grid>
        <Grid size={12}>
          <Typography variant="h3">Choose a tenant</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Your account serves more than one tenant. Pick the one you want to work in.
          </Typography>
        </Grid>
        {error && (
          <Grid size={12}>
            <Alert severity="error">{error}</Alert>
          </Grid>
        )}
        <Grid size={12}>
          <Stack spacing={1.5}>
            {(tenants ?? []).map((candidate) => (
              <TenantTile
                key={candidate.code}
                candidate={candidate}
                current={candidate.id === tenant?.id}
                busy={busyCode === candidate.code}
                disabled={busyCode !== null}
                onSelect={() => handleSelect(candidate.code)}
              />
            ))}
          </Stack>
        </Grid>
      </Grid>
    </AuthWrapper>
  );
}
