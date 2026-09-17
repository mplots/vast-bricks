import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
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

import { useGetShippingPriceCountries, useGetShippingPrices } from 'api/shippingPrices';
import MainCard from 'components/MainCard';
import type { ShippingPrice, ShippingPriceCountry } from 'types/shippingPrices';

/** The screen's own row: one weight band, with each service's price beside it. */
interface BandRow {
  weightFromGrams: number;
  weightToGrams: number;
  economy?: ShippingPrice;
  standard?: ShippingPrice;
  parcel?: ShippingPrice;
}

const numericCell = { textAlign: 'right', whiteSpace: 'nowrap' } as const;

const formatWeight = (grams: number) => (grams % 1000 === 0 && grams >= 1000 ? `${grams / 1000} kg` : `${grams} g`);

const formatBand = (from: number, to: number) => (from === 0 ? `≤ ${formatWeight(to)}` : `${formatWeight(from)} – ${formatWeight(to)}`);

const formatMoney = (value?: number, currency = 'EUR') =>
  value === undefined || value === null
    ? '—'
    : new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);

/**
 * The bands as the tariff book lays them out: one row per weight, the services across the columns.
 *
 * <p>The two shipment types share the rows rather than sitting in tables of their own, because they answer one
 * question between them - what this costs to post - and a reader following a weight upwards crosses from a small
 * packet to a parcel without wanting to look somewhere else for it.
 */
function toBandRows(prices: ShippingPrice[]): BandRow[] {
  const rows = new Map<number, BandRow>();

  for (const price of prices) {
    const row = rows.get(price.weightToGrams) ?? {
      weightFromGrams: price.weightFromGrams,
      weightToGrams: price.weightToGrams
    };
    if (price.shipmentType === 'PARCEL') row.parcel = price;
    else if (price.service === 'ECONOMY') row.economy = price;
    else if (price.service === 'STANDARD') row.standard = price;
    // A small packet band and a parcel band can share a ceiling (both end at 1 kg and at 2 kg), and where they do
    // the lighter of the two starts the row: a 501-1000 g small packet beside a parcel priced from zero.
    row.weightFromGrams = Math.min(row.weightFromGrams, price.weightFromGrams);
    rows.set(price.weightToGrams, row);
  }

  return [...rows.values()].sort((one, other) => one.weightToGrams - other.weightToGrams);
}

/**
 * A service column's heading: its name, and under it whether the shipment can be followed.
 *
 * <p>Said under every column rather than only the two it is true of, because the question a reader is answering
 * here is which service to buy, and "trackable" means nothing as a label until something beside it is not. Economy
 * is the unregistered one; Standard is registered and tracked at every stage; and a Parcel is sold only as
 * Standard+, which is registered and signed for - so tracking is not an extra on it, which is why the provider
 * quotes no separate fee for it and this column never shows a split.
 */
function ServiceHeading({ service, trackable, example }: { service: string; trackable: boolean; example?: ShippingPrice }) {
  const intl = useIntl();

  return (
    <TableCell sx={numericCell}>
      <Typography variant="inherit">{intl.formatMessage({ id: service })}</Typography>
      <Typography variant="caption" sx={{ display: 'block', fontWeight: 400, color: trackable ? 'success.main' : 'text.secondary' }}>
        {intl.formatMessage({ id: trackable ? 'shipping-prices-trackable' : 'shipping-prices-not-trackable' })}
      </Typography>
      <DeliveryDays price={example} />
    </TableCell>
  );
}

/**
 * How long a service takes, as the provider estimates it.
 *
 * <p>Stated once under each service's heading rather than on every row, because it does not vary by weight: a 100 g
 * packet and a 2 kg one to the same place take the same time. A single number where the provider offers one, and a
 * range where it offers a range.
 */
function DeliveryDays({ price }: { price?: ShippingPrice }) {
  const intl = useIntl();

  if (!price?.deliveryDaysMin) {
    return null;
  }

  const days =
    price.deliveryDaysMax && price.deliveryDaysMax !== price.deliveryDaysMin
      ? `${price.deliveryDaysMin}\u2013${price.deliveryDaysMax}`
      : `${price.deliveryDaysMin}`;

  return (
    <Typography variant="caption" sx={{ display: 'block', fontWeight: 400, color: 'text.secondary' }}>
      {intl.formatMessage({ id: 'shipping-prices-days' }, { days })}
    </Typography>
  );
}

/** A price cell, showing the total and saying what it is made of where the two differ. */
function PriceCell({ price }: { price?: ShippingPrice }) {
  const intl = useIntl();

  if (!price) {
    return <TableCell sx={numericCell}>{'—'}</TableCell>;
  }

  const total = formatMoney(price.totalPrice, price.currency);
  if (!price.trackingFee) {
    return <TableCell sx={numericCell}>{total}</TableCell>;
  }

  const split = intl.formatMessage(
    { id: 'shipping-prices-split' },
    { base: formatMoney(price.basePrice, price.currency), tracking: formatMoney(price.trackingFee, price.currency) }
  );

  return (
    <Tooltip title={split} arrow>
      <TableCell sx={{ ...numericCell, borderBottom: '1px dotted', borderBottomColor: 'divider', cursor: 'help' }}>
        {total}
      </TableCell>
    </Tooltip>
  );
}

export default function ShippingPricesPage() {
  const intl = useIntl();
  const { countries, countriesError, countriesLoading } = useGetShippingPriceCountries();
  const [country, setCountry] = useState<ShippingPriceCountry | null>(null);
  const { shippingPrices, shippingPricesError, shippingPricesLoading } = useGetShippingPrices(country?.code ?? null);

  // The selector opens on somewhere rather than on nothing: a screen of one empty dropdown says less about what it
  // holds than the same screen already showing a tariff does.
  useEffect(() => {
    if (!country && countries?.length) {
      setCountry(countries.find((one) => one.code === 'DE') ?? countries[0]);
    }
  }, [countries, country]);

  const rows = useMemo(() => toBandRows(shippingPrices?.prices ?? []), [shippingPrices]);

  // Any band of a service will do for its delivery estimate: the provider states one per service, not per weight.
  const anyOf = (shipmentType: string, service: string) =>
    shippingPrices?.prices.find((price) => price.shipmentType === shipmentType && price.service === service);

  return (
    <Stack spacing={2}>
      {countriesError && <Alert severity="error">{intl.formatMessage({ id: 'shipping-prices-error' })}</Alert>}
      {shippingPricesError && <Alert severity="error">{intl.formatMessage({ id: 'shipping-prices-error' })}</Alert>}

      <MainCard content={false}>
        <Box sx={{ p: 2.5 }}>
          <Autocomplete
            sx={{ maxWidth: 360 }}
            options={countries ?? []}
            loading={countriesLoading}
            value={country}
            onChange={(_event, chosen) => setCountry(chosen)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.code === value.code}
            renderInput={(params) => <TextField {...params} label={intl.formatMessage({ id: 'shipping-prices-country' })} />}
          />
        </Box>

        {shippingPricesLoading && (
          <Stack sx={{ p: 2.5, gap: 1 }}>
            {[0, 1, 2, 3, 4].map((line) => (
              <Skeleton key={line} height={32} />
            ))}
          </Stack>
        )}

        {!shippingPricesLoading && rows.length === 0 && (
          <Box sx={{ p: 2.5 }}>
            <Typography variant="body2" color="text.secondary">
              {intl.formatMessage({ id: 'shipping-prices-none' })}
            </Typography>
          </Box>
        )}

        {!shippingPricesLoading && rows.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{intl.formatMessage({ id: 'shipping-prices-weight' })}</TableCell>
                  <ServiceHeading service="shipping-prices-economy" trackable={false} example={anyOf('SMALL_PACKET', 'ECONOMY')} />
                  <ServiceHeading service="shipping-prices-standard" trackable example={anyOf('SMALL_PACKET', 'STANDARD')} />
                  {/* A Parcel is only ever Standard+, which is registered and signed for, so it is tracked
                      whether or not anyone asks - there is no untracked parcel to choose instead. */}
                  <ServiceHeading service="shipping-prices-parcel" trackable example={anyOf('PARCEL', 'STANDARD_PLUS')} />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.weightToGrams} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatBand(row.weightFromGrams, row.weightToGrams)}</TableCell>
                    <PriceCell price={row.economy} />
                    <PriceCell price={row.standard} />
                    <PriceCell price={row.parcel} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {shippingPrices?.checkedAt && (
          <Box sx={{ px: 2.5, py: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              {intl.formatMessage(
                { id: 'shipping-prices-checked' },
                { when: new Date(shippingPrices.checkedAt).toLocaleDateString() }
              )}
            </Typography>
          </Box>
        )}
      </MainCard>
    </Stack>
  );
}
