import { ChangeEvent, FormEvent, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import MainCard from 'components/MainCard';
import { useGetProducts } from 'api/products';
import type { ProductOffer, ProductPrice, ProductQueryParams } from 'types/product';

const formatCurrency = (value?: number | null, options?: { prefix?: string }) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  const roundedValue = Math.round(value * 100) / 100;
  return `${options?.prefix ?? '€'}${roundedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatNumber = (value?: number | null, fractionDigits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return Number(value).toFixed(fractionDigits);
};

const sanitizeTitle = (title?: string) => {
  if (!title) return '';
  return title.replace(/lego/gi, '').trim() || title;
};

const toNumber = (value?: number | string | null) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

type FilterFormState = {
  limit: string;
  set: string;
  atl: boolean;
};

const defaultFilters: FilterFormState = {
  limit: '50',
  set: '',
  atl: false
};

const ProductCard = ({ product, prices }: { product: ProductOffer; prices: ProductPrice[] }) => {
  const [showPrices, setShowPrices] = useState(false);
  const price = toNumber(product.price) ?? 0;
  const lowestPrice = toNumber(product.lowestPrice);
  const partOutPrice = toNumber(product.partOutPrice);
  const ratio = toNumber(product.partOutRatio);
  const perPiece = toNumber(product.pricePeerPeace);
  const profit = partOutPrice !== undefined ? partOutPrice - price : undefined;

  const title = sanitizeTitle(product.setName);
  const eanLabel = product.eanIds?.length ? `EANs: ${product.eanIds.join(', ')}` : null;

  const metrics = [
    { label: 'Price', value: formatCurrency(price) },
    { label: 'ATL Price', value: formatCurrency(lowestPrice ?? null) },
    { label: 'Ratio', value: formatNumber(ratio) },
    { label: 'Part out', value: formatCurrency(partOutPrice ?? null) },
    { label: 'Per piece', value: formatCurrency(perPiece ?? null) },
    { label: 'Profit', value: formatCurrency(profit ?? null), color: profit !== undefined && profit > 0 ? 'success.main' : undefined }
  ];

  const salidziniUrl = `https://www.salidzini.lv/cena?q=lego+${product.setNumber}!`;

  return (
    <MainCard contentSX={{ p: { xs: 2, sm: 3 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="stretch">
        <Box
          sx={{
            flex: { md: '0 0 260px' },
            textAlign: 'center',
            position: 'relative'
          }}
        >
          <Box
            sx={{
              position: 'relative',
              display: 'inline-flex',
              justifyContent: 'center'
            }}
          >
            <Box
              component="img"
              src={product.image}
              alt={title}
              onError={(event) => {
                (event.target as HTMLImageElement).style.display = 'none';
              }}
              sx={{
                maxHeight: 200,
                maxWidth: '100%',
                width: 'auto',
                borderRadius: 2,
                backgroundColor: 'background.default',
                objectFit: 'contain',
                p: 1
              }}
            />
            {product.pieces ? (
              <Chip
                size="small"
                color="primary"
                label={`${product.pieces} pcs`}
                sx={{ position: 'absolute', top: 12, right: -4, fontWeight: 600 }}
              />
            ) : null}
            {product.lots ? (
              <Chip
                size="small"
                color="secondary"
                label={`${product.lots} lots`}
                sx={{ position: 'absolute', top: 44, right: -4, fontWeight: 600 }}
              />
            ) : null}
          </Box>
        </Box>
        <Stack spacing={2} width="100%">
          <Box>
            <Stack spacing={1} direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} flexWrap="wrap">
              <Typography variant="h5" sx={{ mr: 1 }}>
                {title}
              </Typography>
              <Chip label={`#${product.setNumber}`} size="small" />
              {product.theme && <Chip label={product.theme} size="small" variant="outlined" color="primary" />}
            </Stack>
            {eanLabel && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {eanLabel}
              </Typography>
            )}
          </Box>
          <Grid container spacing={2}>
            {metrics.map((metric) => (
              <Grid key={metric.label} item xs={12} sm={6} lg={4}>
                <Stack
                  spacing={0.5}
                  sx={{
                    p: 1.5,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    height: '100%'
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    {metric.label}
                  </Typography>
                  <Typography variant="h6" color={metric.color ?? 'text.primary'}>
                    {metric.value}
                  </Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
          <Divider />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
          >
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" color="text.secondary">
                Sold by
              </Typography>
              <Button
                component="a"
                href={product.purchaseLink}
                target="_blank"
                rel="noopener noreferrer"
                variant="contained"
                sx={{ width: 'fit-content' }}
              >
                {product.webStore}
              </Button>
              <Typography variant="caption" color="text.secondary">
                Updated {product.priceTimestamp}
              </Typography>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button component="a" href={salidziniUrl} target="_blank" rel="noopener noreferrer" variant="outlined">
                Salidzini
              </Button>
              <Button component="a" href={product.partOutLink} target="_blank" rel="noopener noreferrer" variant="outlined">
                Part Out Value
              </Button>
              <Button variant="text" onClick={() => setShowPrices(true)} disabled={!prices?.length}>
                Store prices
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Stack>
      <Dialog open={showPrices} onClose={() => setShowPrices(false)} fullWidth maxWidth="sm">
        <DialogTitle>Store prices - #{product.setNumber}</DialogTitle>
        <DialogContent dividers>
          {prices?.length ? (
            <Stack spacing={1}>
              {prices.map((price) => {
                const storePrice = toNumber(price.price);
                return (
                  <Stack
                    key={`${price.offerId}-${price.timestamp}`}
                    direction="row"
                    spacing={1}
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1.5,
                      py: 0.75,
                      px: 1.5
                    }}
                  >
                    <Stack spacing={0.25}>
                      <Typography variant="subtitle2" sx={{ fontSize: '0.85rem' }}>
                        {price.webStore}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {price.timestamp}
                      </Typography>
                    </Stack>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {formatCurrency(storePrice ?? null)}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          ) : (
            <Typography>No price history available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPrices(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </MainCard>
  );
};

export default function ProductsPage() {
  const [query, setQuery] = useState<ProductQueryParams>({ limit: Number(defaultFilters.limit) });
  const [formState, setFormState] = useState<FilterFormState>(defaultFilters);

  const { products, productsLoading, productsError } = useGetProducts(query);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery({
      limit: formState.limit ? Number(formState.limit) : undefined,
      set: formState.set ? Number(formState.set) : undefined,
      atl: formState.atl
    });
  };

  const handleInputChange = (field: keyof FilterFormState) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = field === 'atl' ? event.target.checked : event.target.value;
    setFormState((prev) => ({ ...prev, [field]: value }) as FilterFormState);
  };

  const content = useMemo(() => {
    if (productsLoading) {
      return (
        <Stack spacing={2}>
          {[...Array(3)].map((_, index) => (
            <Skeleton key={index} variant="rounded" height={280} />
          ))}
        </Stack>
      );
    }

    if (productsError) {
      return (
        <MainCard>
          <Typography color="error">Failed to load products. Please try again later.</Typography>
        </MainCard>
      );
    }

    if (!products.length) {
      return (
        <MainCard>
          <Typography>No products to display for the selected filters.</Typography>
        </MainCard>
      );
    }

    return (
      <Stack spacing={2}>
        {products.map(({ offer, prices }) => (
          <ProductCard key={offer.productId} product={offer} prices={prices} />
        ))}
      </Stack>
    );
  }, [products, productsError, productsLoading]);

  return (
    <Stack spacing={3}>
      <MainCard title="Products" contentSX={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          component="form"
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'flex-end' }}
          onSubmit={handleSubmit}
        >
          <TextField
            label="Limit"
            name="limit"
            type="number"
            value={formState.limit}
            onChange={handleInputChange('limit')}
            inputProps={{ min: 1, max: 200 }}
          />
          <TextField label="Set Number" name="set" value={formState.set} onChange={handleInputChange('set')} placeholder="e.g. 75383" />
          <FormControlLabel control={<Switch checked={formState.atl} onChange={handleInputChange('atl')} />} label="Only ATL price" />
          <Button type="submit" variant="contained" size="large" sx={{ minWidth: 160 }}>
            Apply Filters
          </Button>
        </Stack>
      </MainCard>
      {content}
    </Stack>
  );
}
