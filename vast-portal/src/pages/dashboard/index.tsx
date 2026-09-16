import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Refresh } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';
import { useSearchParams } from 'react-router-dom';

import { useGetOrderCountries } from 'api/orders';
import IconButton from 'components/@extended/IconButton';
import MainCard from 'components/MainCard';
import DatePeriodPicker from 'components/period/DatePeriodPicker';
import toolButtonSx from 'components/toolButton';
import OrderCountriesChart from 'sections/dashboard/OrderCountriesChart';
import { currentMonth, monthDate } from 'utils/month';

/**
 * What the store's period came to, read rather than listed.
 *
 * <p>The screen the portal opens on. It answers the questions a store asks before it asks about any one order -
 * where the orders went, and presently how many and for how much - off the same stored orders the orders screen
 * lists, so it costs a read and no provider call.
 *
 * <p>It is worn the way the orders screen is: the same range picker in the same place, writing the same `dateFrom`,
 * `dateTo` and `periodView` into the address. A reader moving between the two screens carries the period with them,
 * and a period linked to from elsewhere opens the same way on either.
 */
export default function DashboardPage() {
  const intl = useIntl();
  const [searchParams, setSearchParams] = useSearchParams();

  // The month now, so a screen opened with nothing in the address reads what has just come in.
  const month = currentMonth();
  const defaultFrom = `${month}-01`;
  const defaultTo = (() => {
    const first = monthDate(month);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  })();

  const dateFrom = searchParams.get('dateFrom') ?? defaultFrom;
  const dateTo = searchParams.get('dateTo') ?? defaultTo;

  const { countries, countriesError, countriesLoading, countriesRefreshing, reloadCountries } = useGetOrderCountries(dateFrom, dateTo);
  const counted = countries?.countries ?? [];
  const total = counted.reduce((orders, country) => orders + country.orders, 0);

  const applyPeriod = (from: string, to: string, view: 'month' | 'year' | 'range') => {
    const params = new URLSearchParams(searchParams);
    params.set('periodView', view);
    params.set('dateFrom', from);
    params.set('dateTo', to);
    setSearchParams(params);
  };

  const periodBar = (
    <Stack component="span" direction="row" useFlexGap sx={{ gap: 1.5, alignItems: 'center' }}>
      <DatePeriodPicker
        allowRange
        from={dateFrom}
        to={dateTo}
        view={
          searchParams.get('periodView') === 'year'
            ? 'year'
            : searchParams.get('periodView') === 'month' || !searchParams.has('dateFrom')
              ? 'month'
              : 'range'
        }
        onApply={applyPeriod}
      />
      {countries && (
        <Typography component="span" variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
          {intl.formatMessage({ id: 'dashboard-countries-orders' }, { count: total })}
        </Typography>
      )}
    </Stack>
  );

  const reload = (
    <Tooltip title={intl.formatMessage({ id: countriesRefreshing ? 'dashboard-refreshing' : 'dashboard-refresh' })} arrow>
      <span>
        <IconButton
          variant="light"
          color="secondary"
          disabled={countriesRefreshing}
          aria-label={intl.formatMessage({ id: 'dashboard-refresh' })}
          onClick={() => reloadCountries()}
          sx={toolButtonSx}
        >
          {countriesRefreshing ? <CircularProgress size={18} color="inherit" /> : <Refresh size={18} />}
        </IconButton>
      </span>
    </Tooltip>
  );

  return (
    <Stack spacing={2.5}>
      {/* The period is the whole screen's, not one card's, so it sits above them all in a bar of its own - the same
          bar the orders screen wears, in the same place, holding the same picker. */}
      <MainCard content={false} title={periodBar} secondary={reload} divider={false} sx={{ '& .MuiCardHeader-root': { py: 1.5 } }} />

      {/* A grid for one card, because a dashboard is a set of them: where a period's orders went is the first
          question of several, and the next answer goes beside this one rather than instead of it. */}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 7, lg: 5 }}>
          <MainCard title={intl.formatMessage({ id: 'dashboard-countries' })}>
            {countriesLoading && <Skeleton variant="circular" width={280} height={280} sx={{ mx: 'auto' }} />}

            {countriesError && (
              <Alert severity="error">{countriesError.message || intl.formatMessage({ id: 'dashboard-countries-error' })}</Alert>
            )}

            {!countriesLoading &&
              !countriesError &&
              countries &&
              (counted.length ? (
                <OrderCountriesChart countries={counted} />
              ) : (
                <Box sx={{ py: 4 }}>
                  <Alert severity="info">{intl.formatMessage({ id: 'dashboard-countries-none' })}</Alert>
                </Box>
              ))}
          </MainCard>
        </Grid>
      </Grid>
    </Stack>
  );
}
