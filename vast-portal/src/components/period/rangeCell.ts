import type { SxProps, Theme } from '@mui/material/styles';

/**
 * How one cell of a range grid reads, shared by the day calendar and the month and year grids beside it: they sit in
 * the same popover, so a range must look the same whichever of them drew it.
 */

/** The band behind a cell: filled while the cell is inside the range, rounded where the range ends. */
export const rangeBandSx = (inside: boolean, start: boolean, end: boolean): SxProps<Theme> => ({
  bgcolor: inside ? 'primary.lighter' : 'transparent',
  borderTopLeftRadius: start ? 8 : 0,
  borderBottomLeftRadius: start ? 8 : 0,
  borderTopRightRadius: end ? 8 : 0,
  borderBottomRightRadius: end ? 8 : 0
});

/** The cell itself: an endpoint is filled, the endpoint a hover would move to is outlined. */
export const rangeCellSx = (endpoint: boolean, outlined: boolean, muted = false): SxProps<Theme> => ({
  minWidth: 0,
  p: 0,
  borderRadius: 1,
  textTransform: 'none',
  bgcolor: endpoint ? 'primary.main' : 'transparent',
  color: endpoint ? 'primary.contrastText' : muted ? 'text.disabled' : 'text.primary',
  outline: outlined ? '2px solid' : undefined,
  outlineColor: 'primary.main',
  outlineOffset: -2,
  // The theme paints a hovered button's label in the primary colour, which on a filled endpoint is the colour it
  // sits on. Each state keeps the label it reads in, so hovering never rubs a date out.
  '&:hover': {
    bgcolor: endpoint ? 'primary.dark' : 'primary.lighter',
    color: endpoint ? 'primary.contrastText' : 'text.primary'
  }
});
