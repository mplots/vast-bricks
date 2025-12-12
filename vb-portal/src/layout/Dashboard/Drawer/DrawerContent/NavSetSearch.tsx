import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';

export default function NavSetSearch() {
  const navigate = useNavigate();
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;

  const [setNumber, setSetNumber] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedSetNumber = setNumber.trim();
    if (!trimmedSetNumber) return;

    const params = new URLSearchParams();
    params.set('set', trimmedSetNumber);
    navigate(`/products?${params.toString()}`);

    if (downLG && drawerOpen) {
      handlerDrawerOpen(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ px: 3, pt: 2, pb: 1.5 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle1">Find a set</Typography>
        <TextField
          size="small"
          label="Set number"
          value={setNumber}
          onChange={(event) => setSetNumber(event.target.value)}
          placeholder="e.g. 75383"
          inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
        />
        <Button type="submit" variant="contained" size="small" disabled={!setNumber.trim()}>
          Go to product
        </Button>
      </Stack>
    </Box>
  );
}
