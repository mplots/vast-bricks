import { useState } from 'react';

// material-ui
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';

// project-imports
import useAuth from 'hooks/useAuth';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Lets an already-logged-in user move to another of their account's tenants, in place, without logging out. */
export default function SwitchTenantDialog({ open, onClose }: Props) {
  const { tenant, tenants, switchTenant } = useAuth();
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (code: string) => {
    if (code === tenant?.code) {
      onClose();
      return;
    }
    setBusyCode(code);
    setError(null);
    try {
      await switchTenant(code);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The tenant could not be switched.');
    } finally {
      setBusyCode(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Switch Tenant</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <List sx={{ p: 0 }}>
          {(tenants ?? []).map((candidate) => (
            <ListItemButton
              key={candidate.code}
              selected={candidate.id === tenant?.id}
              disabled={busyCode !== null}
              onClick={() => handleSelect(candidate.code)}
            >
              <ListItemText primary={candidate.name} />
              {busyCode === candidate.code && <CircularProgress size={16} />}
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
