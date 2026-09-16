import { useMemo } from 'react';

import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import { useIntl } from 'react-intl';
import ReactApexChart, { type Props as ChartProps } from 'react-apexcharts';

import { ThemeMode } from 'config';
import type { OrderCountry } from 'types/order';

/**
 * Where a period's orders went, as a pie.
 *
 * <p>A country is a fact of the order rather than of the store, so the slices are read straight off what the
 * marketplaces stated and nothing is grouped by hand: the codes are turned into the reader's own names for them by
 * the browser, which already knows them in every language the portal is read in.
 *
 * <p>Long tails are a store's normal shape - a handful of countries it sells to and a dozen it has sold to once -
 * so the slices stop at a legible number and the rest are counted together. The whole of a period is still the
 * whole pie: the tail is a slice rather than orders left out.
 */

/** How many countries get a slice of their own before the rest are counted together. */
const SLICES = 8;

interface Props {
  countries: OrderCountry[];
  height?: number;
}

export default function OrderCountriesChart({ countries, height = 320 }: Props) {
  const theme = useTheme();
  const intl = useIntl();

  /** A country as the reader names it, the code being what the marketplace stated and not what anyone calls it. */
  const countryName = (country: string | null) => {
    if (!country) return intl.formatMessage({ id: 'dashboard-country-unknown' });
    return intl.formatDisplayName(country, { type: 'region' }) ?? country;
  };

  const slices = useMemo(() => {
    // Already largest first, as the API counts them, so the tail is what falls past the last slice.
    const shown = countries.slice(0, SLICES).map((country) => ({ label: countryName(country.country), orders: country.orders }));
    const tail = countries.slice(SLICES);
    if (tail.length) {
      shown.push({
        label: intl.formatMessage({ id: 'dashboard-countries-other' }, { count: tail.length }),
        orders: tail.reduce((total, country) => total + country.orders, 0)
      });
    }
    return shown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries, intl]);

  const options: ChartProps = useMemo(
    () => ({
      chart: { type: 'pie', background: 'transparent' },
      labels: slices.map((slice) => slice.label),
      // Enough colours that a store selling to eight countries never draws two slices the same, and cycled by
      // ApexCharts past that, which only the grouped tail can reach.
      colors: [
        theme.palette.primary.main,
        theme.palette.warning.main,
        theme.palette.success.main,
        theme.palette.info.main,
        theme.palette.error.main,
        theme.palette.primary.light,
        theme.palette.warning.light,
        theme.palette.success.light,
        theme.palette.secondary.main
      ],
      stroke: { colors: [theme.palette.background.paper] },
      legend: {
        position: 'bottom',
        labels: { colors: theme.palette.text.secondary },
        markers: { strokeWidth: 0 }
      },
      // The slice already says how large it is; what a reader wants off it is the count it stands for.
      dataLabels: { formatter: (percent: number) => `${Math.round(percent)}%` },
      tooltip: {
        y: { formatter: (orders: number) => intl.formatMessage({ id: 'dashboard-countries-orders' }, { count: orders }) }
      },
      theme: { mode: theme.palette.mode === ThemeMode.DARK ? 'dark' : 'light' }
    }),
    [slices, theme, intl]
  );

  return (
    <Box sx={{ '.apexcharts-active': { color: 'common.white' } }}>
      <ReactApexChart options={options} series={slices.map((slice) => slice.orders)} type="pie" height={height} />
    </Box>
  );
}
