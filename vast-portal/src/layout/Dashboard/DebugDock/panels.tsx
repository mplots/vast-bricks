import { ReactNode } from 'react';

// project-imports
import NetworkPanel from 'sections/debug/NetworkPanel';

export type DebugPanel = {
  /** Stable id, persisted as the dock's selected panel. */
  id: string;
  /** Translation key for the tab label. */
  labelId: string;
  element: ReactNode;
};

/**
 * What the dock can show. This is the growth seam: another panel is one entry here, and the dock shell, its state and
 * its toolbar do not change. Network is the first panel, not the only one it is built for.
 */
export const debugPanels: DebugPanel[] = [{ id: 'network', labelId: 'debug-panel-network', element: <NetworkPanel /> }];
