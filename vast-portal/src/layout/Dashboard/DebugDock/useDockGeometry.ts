// project-imports
import { useDebugDock } from 'api/debug';

/**
 * Where the dock sits.
 *
 * <p>It overlays the whole app rather than taking a share of it: pinned to a window edge, above the header and the
 * nav, and the page underneath is left exactly as it was. Giving it space inside the working area meant the page had
 * to shrink around it, which is the opposite of what a tool you open for a moment should do.
 */
export default function useDockGeometry() {
  const dock = useDebugDock();

  return {
    dock,
    /** The dock's fixed box, measured from the window rather than from the page area inside the chrome. */
    position: {
      left: dock.side === 'right' ? undefined : 0,
      right: dock.side === 'left' ? undefined : 0,
      top: dock.side === 'bottom' ? undefined : 0,
      bottom: 0,
      ...(dock.side === 'bottom' ? { height: dock.size } : { width: dock.size })
    }
  };
}
