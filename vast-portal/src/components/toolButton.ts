import type { Theme } from '@mui/material/styles';

/**
 * The look every button on the reconciliation screen wears: the one the app header shows and hides the main menu
 * with. The screen's buttons open and close a panel or ask for the month again, which is the same kind of act, so
 * they are the same kind of button rather than three inventions of their own.
 *
 * <p>Worn with `variant="light" color="secondary"`. The header's own toggle is a size larger, having the whole app
 * behind it; these sit in a title bar and take the default size.
 */
const toolButtonSx = (theme: Theme) => ({
  color: 'secondary.main',
  bgcolor: 'secondary.200',
  ...theme.applyStyles('dark', { bgcolor: 'background.paper' })
});

export default toolButtonSx;
