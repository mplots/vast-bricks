// material-ui
import Button from '@mui/material/Button';

// third-party
import { useIntl } from 'react-intl';

// project-imports
import { openDebugDock, useDebugDock } from 'api/debug';
import { Code } from 'iconsax-reactjs';

/**
 * Opens the debug dock. It sits where the template's Buy Now button used to, which is the corner a tool like this is
 * looked for in, and it is gone while the dock is open because the dock has its own close.
 */
export default function DebugTrigger() {
  const intl = useIntl();
  const { open } = useDebugDock();

  if (open) {
    return null;
  }

  return (
    <Button
      variant="contained"
      color="secondary"
      startIcon={<Code size={18} />}
      onClick={openDebugDock}
      sx={{ zIndex: 1199, position: 'fixed', bottom: 50, right: 30 }}
    >
      {intl.formatMessage({ id: 'debug-open' })}
    </Button>
  );
}
