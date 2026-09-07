// material-ui
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';

// third-party
import { useIntl } from 'react-intl';

// project-imports
import IconButton from 'components/@extended/IconButton';

import { openDebugDock, useDebugDock } from 'api/debug';

// assets
import { Code } from 'iconsax-reactjs';

/**
 * Opens the debug dock. It sits among the header's other tools, in the corner a tool like this is looked for in, and it
 * is gone while the dock is open because the dock has its own close.
 */
export default function DebugTrigger() {
  const intl = useIntl();
  const { open } = useDebugDock();

  if (open) {
    return null;
  }

  const label = intl.formatMessage({ id: 'debug-open' });

  return (
    <Box sx={{ flexShrink: 0, ml: 0.75 }}>
      <Tooltip title={label}>
        <IconButton
          aria-label={label}
          color="secondary"
          variant="light"
          onClick={openDebugDock}
          size="large"
          sx={(theme) => ({
            p: 1,
            color: 'secondary.main',
            bgcolor: 'secondary.100',
            ...theme.applyStyles('dark', { bgcolor: 'background.default' })
          })}
        >
          <Code variant="Bulk" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
