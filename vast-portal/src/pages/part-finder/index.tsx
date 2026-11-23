import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';

import { useGetSetsForSale, useSearchPartColors } from 'api/partFinder';
import MainCard from 'components/MainCard';
import type { PartColor } from 'types/partFinder';

const formatMoney = (value: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(value);

const partColorLabel = (option: PartColor) => `${option.partName} — ${option.colorName}`;

function ColorSwatch({ rgb }: { rgb: string | null }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: 12,
        height: 12,
        borderRadius: 0.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: rgb ? `#${rgb}` : 'transparent',
        verticalAlign: 'middle',
        mr: 0.75
      }}
    />
  );
}

/** A set's thumbnail, shown large while hovered. */
function SetImage({ image, name }: { image: string | null; name: string }) {
  const thumbnail = <Avatar variant="rounded" src={image ?? undefined} sx={{ width: 48, height: 48, bgcolor: 'transparent' }} />;

  if (!image) {
    return thumbnail;
  }

  return (
    <Tooltip
      placement="right"
      title={<Box component="img" src={image} alt={name} sx={{ display: 'block', maxWidth: 400, maxHeight: 400 }} />}
      slotProps={{ tooltip: { sx: { maxWidth: 'none', p: 1, bgcolor: 'background.paper', boxShadow: 3 } } }}
    >
      {thumbnail}
    </Tooltip>
  );
}

export default function PartFinderPage() {
  const intl = useIntl();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [partColor, setPartColor] = useState<PartColor | null>(null);

  // Asks once typing pauses rather than on every key.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const { partColors, partColorsError, partColorsLoading } = useSearchPartColors(query);
  const { sets, setsError, setsLoading } = useGetSetsForSale(partColor);

  return (
    <Stack spacing={2}>
      {(partColorsError || setsError) && <Alert severity="error">{intl.formatMessage({ id: 'part-finder-error' })}</Alert>}

      <MainCard content={false}>
        <Box sx={{ p: 2.5 }}>
          <Autocomplete
            sx={{ maxWidth: 560 }}
            options={partColors ?? []}
            loading={partColorsLoading}
            value={partColor}
            onChange={(_event, chosen) => setPartColor(chosen)}
            inputValue={input}
            onInputChange={(_event, value) => setInput(value)}
            filterOptions={(all) => all}
            getOptionLabel={partColorLabel}
            isOptionEqualToValue={(option, value) => option.partNum === value.partNum && option.colorId === value.colorId}
            noOptionsText={intl.formatMessage({ id: query.trim().length >= 2 ? 'part-finder-no-parts' : 'part-finder-type' })}
            renderOption={({ key, ...props }, option) => (
              <Box component="li" key={key} {...props} sx={{ gap: 1.5 }}>
                <Avatar variant="rounded" src={option.image ?? undefined} sx={{ width: 32, height: 32, bgcolor: 'transparent' }} />
                <Box>
                  <Typography variant="body2">{option.partName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    <ColorSwatch rgb={option.colorRgb} />
                    {option.colorName} · {option.partNum} ·{' '}
                    {intl.formatMessage({ id: 'part-finder-set-count' }, { count: option.setCount })}
                  </Typography>
                </Box>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                label={intl.formatMessage({ id: 'part-finder-part' })}
                placeholder="Tile 1 x 1 Dark Bluish Gray"
              />
            )}
          />
        </Box>

        {setsLoading && (
          <Stack sx={{ p: 2.5, gap: 1 }}>
            {[0, 1, 2, 3, 4].map((line) => (
              <Skeleton key={line} height={48} />
            ))}
          </Stack>
        )}

        {partColor && !setsLoading && sets?.length === 0 && (
          <Box sx={{ p: 2.5 }}>
            <Typography variant="body2" color="text.secondary">
              {intl.formatMessage({ id: 'part-finder-no-sets' })}
            </Typography>
          </Box>
        )}

        {partColor && !setsLoading && !!sets?.length && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{intl.formatMessage({ id: 'part-finder-set' })}</TableCell>
                  <TableCell align="right">{intl.formatMessage({ id: 'part-finder-quantity' })}</TableCell>
                  <TableCell>{intl.formatMessage({ id: 'part-finder-stores' })}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sets.map((set) => (
                  <TableRow key={set.setNumber} hover>
                    <TableCell>
                      <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                        <SetImage image={set.image} name={set.setName} />
                        <Box>
                          <Typography variant="subtitle2">
                            {set.setNumber} {set.setName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {[set.theme, set.pieces && intl.formatMessage({ id: 'part-finder-pieces' }, { count: set.pieces })]
                              .filter(Boolean)
                              .join(' · ')}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{set.partQty}</TableCell>
                    <TableCell>
                      <Stack sx={{ gap: 0.25 }}>
                        {set.stores.map((store) => (
                          <Typography key={store.webStore} variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                            <Link href={store.link} target="_blank" rel="noopener noreferrer">
                              {store.webStore}
                            </Link>{' '}
                            {formatMoney(store.price)}
                          </Typography>
                        ))}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </MainCard>
    </Stack>
  );
}
