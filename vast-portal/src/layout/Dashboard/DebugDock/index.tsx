// material-ui
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';

// third-party
import { useIntl } from 'react-intl';

// project-imports
import IconButton from 'components/@extended/IconButton';
import { closeDebugDock, setDebugDockSide, setDebugDockSize, setDebugPanel } from 'api/debug';
import type { DebugDockSide } from 'types/debug';
import { Add } from 'iconsax-reactjs';

import DebugDockResizer from './DebugDockResizer';
import useDockGeometry from './useDockGeometry';
import { debugPanels } from './panels';

const sides: DebugDockSide[] = ['left', 'bottom', 'right'];

/** The dock icon per side, drawn as a small box so the three read as one control rather than three unrelated glyphs. */
const sideIcon = (side: DebugDockSide, active: boolean) => (
  <Box sx={{ position: 'relative', width: 16, height: 14, border: 1, borderColor: 'currentColor', borderRadius: 0.5 }}>
    <Box
      sx={{
        position: 'absolute',
        bgcolor: 'currentColor',
        opacity: active ? 1 : 0.45,
        ...(side === 'left' && { left: 0, top: 0, bottom: 0, width: 6 }),
        ...(side === 'right' && { right: 0, top: 0, bottom: 0, width: 6 }),
        ...(side === 'bottom' && { left: 0, right: 0, bottom: 0, height: 5 })
      }}
    />
  </Box>
);

/**
 * The debug dock: the portal's network tab for the backend.
 *
 * <p>It docks left, right or bottom, overlaying the whole app — header and nav included — rather than taking a share
 * of the working area. It is a tool opened for a moment: the page underneath keeps its own layout, and closing the
 * dock leaves nothing to reflow.
 */
export default function DebugDock() {
  const intl = useIntl();
  const { dock, position } = useDockGeometry();
  const { open, side, panel } = dock;

  if (!open) {
    return null;
  }

  const horizontal = side === 'bottom';
  const active = debugPanels.find((candidate) => candidate.id === panel) ?? debugPanels[0];

  return (
    <Box
      sx={{
        position: 'fixed',
        // Above the header and the nav, which both sit at 1200, and below MUI's modals so a dialog still opens over it.
        zIndex: 1250,
        display: 'flex',
        flexDirection: horizontal ? 'column' : 'row',
        boxShadow: 3,
        ...position
      }}
    >
      {/* The resizer sits on the edge that faces the app, so dragging it grows the dock over more of the page. */}
      {(side === 'right' || side === 'bottom') && <DebugDockResizer side={side} onResize={setDebugDockSize} />}

      <Paper square elevation={0} sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', borderRadius: 0 }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, pr: 1, flexShrink: 0 }}>
          <Tabs
            value={active.id}
            onChange={(_event, next: string) => setDebugPanel(next)}
            variant="scrollable"
            sx={{ minHeight: 40, flex: 1, '& .MuiTab-root': { minHeight: 40, py: 0 } }}
          >
            {debugPanels.map((candidate) => (
              <Tab key={candidate.id} value={candidate.id} label={intl.formatMessage({ id: candidate.labelId })} />
            ))}
          </Tabs>

          {sides.map((candidate) => (
            <Tooltip key={candidate} title={intl.formatMessage({ id: `debug-dock-${candidate}` })}>
              <IconButton
                size="small"
                color={candidate === side ? 'primary' : 'secondary'}
                aria-label={intl.formatMessage({ id: `debug-dock-${candidate}` })}
                onClick={() => setDebugDockSide(candidate)}
              >
                {sideIcon(candidate, candidate === side)}
              </IconButton>
            </Tooltip>
          ))}

          <Tooltip title={intl.formatMessage({ id: 'debug-dock-close' })}>
            <IconButton size="small" color="secondary" aria-label={intl.formatMessage({ id: 'debug-dock-close' })} onClick={closeDebugDock}>
              <Add size={18} style={{ transform: 'rotate(45deg)' }} />
            </IconButton>
          </Tooltip>
        </Stack>
        <Divider />

        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{active.element}</Box>
      </Paper>

      {side === 'left' && <DebugDockResizer side={side} onResize={setDebugDockSize} />}
    </Box>
  );
}
