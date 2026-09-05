import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import { Global } from 'iconsax-reactjs';

import type { OrderTaxType } from 'types/tax';

// Latvia's own carmine, and the European flag's blue and gold, so a flag reads as itself rather than as the theme.
const latvianCarmine = '#9E3039';
const europeanBlue = '#003399';
const europeanGold = '#FFCC00';

type FlagProps = { size: number };

/**
 * A flag is drawn as a rounded rectangle the width of the icon box, over an outline so a white band still shows an
 * edge. Everything inside it stays clear of the rounded corners, which is why the flag needs no clip path: one id
 * would have to be unique per row.
 */
const Flag = ({ size, children }: FlagProps & { children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" role="presentation" focusable="false">
    {children}
    <rect x="0.5" y="3.5" width="19" height="13" rx="2" fill="none" stroke="currentColor" strokeOpacity="0.25" />
  </svg>
);

const LatvianFlag = ({ size }: FlagProps) => (
  <Flag size={size}>
    {/* Carmine, white, carmine in the flag's own 2:1:2 bands. */}
    <rect x="0.5" y="3.5" width="19" height="13" rx="2" fill={latvianCarmine} />
    <rect x="0.5" y="8.7" width="19" height="2.6" fill="#FFFFFF" />
  </Flag>
);

const EuropeanFlag = ({ size }: FlagProps) => (
  <Flag size={size}>
    <rect x="0.5" y="3.5" width="19" height="13" rx="2" fill={europeanBlue} />
    {/* Twelve stars in a circle. At this size a five-point star renders as a blot, so each is drawn as a dot. */}
    {Array.from({ length: 12 }, (_, star) => {
      const angle = (star * Math.PI) / 6;
      return <circle key={star} cx={10 + 4 * Math.sin(angle)} cy={10 - 4 * Math.cos(angle)} r="0.85" fill={europeanGold} />;
    })}
  </Flag>
);

/** The world, and the world with the tax it was charged anyway: the same icon, marked in the corner it leaves free. */
const World = ({ size, taxable }: FlagProps & { taxable?: boolean }) => (
  <Box sx={{ position: 'relative', display: 'inline-flex', color: 'text.secondary' }}>
    <Global size={size} color="currentColor" />
    {taxable && (
      <Box
        component="span"
        sx={{
          position: 'absolute',
          right: -3,
          bottom: -2,
          fontSize: size * 0.6,
          fontWeight: 700,
          lineHeight: 1,
          color: 'text.primary'
        }}
      >
        %
      </Box>
    )}
  </Box>
);

/**
 * The order's tax type as a mark rather than a word: a flag for the two a flag says outright, the world for a sale
 * beyond it, and the world marked with a percent for one that was taxed all the same. The type is worded wherever the
 * icon sits, so the icon never carries it alone.
 */
export default function OrderTaxTypeIcon({ taxType, size = 18 }: { taxType: OrderTaxType; size?: number }) {
  switch (taxType) {
    case 'domestic':
      return <LatvianFlag size={size} />;
    case 'european-union':
      return <EuropeanFlag size={size} />;
    case 'export-taxable':
      return <World size={size} taxable />;
    default:
      return <World size={size} />;
  }
}
