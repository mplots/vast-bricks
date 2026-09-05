import { useCallback, useEffect, useRef } from 'react';

// material-ui
import Box from '@mui/material/Box';

// project-imports
import type { DebugDockSide } from 'types/debug';

type Props = {
  side: DebugDockSide;
  onResize: (size: number) => void;
};

/**
 * The dock's edge, dragged to resize it. Pointer events are captured on the handle so a fast drag that leaves the
 * element keeps resizing, which a plain mousemove listener on the handle would not.
 */
export default function DebugDockResizer({ side, onResize }: Props) {
  const dragging = useRef(false);

  const sizeFrom = useCallback(
    (event: PointerEvent | React.PointerEvent) => {
      if (side === 'bottom') return window.innerHeight - event.clientY;
      return side === 'left' ? event.clientX : window.innerWidth - event.clientX;
    },
    [side]
  );

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (dragging.current) {
        onResize(sizeFrom(event));
      }
    };
    const stop = () => {
      dragging.current = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
  }, [onResize, sizeFrom]);

  const horizontal = side === 'bottom';

  return (
    <Box
      role="separator"
      aria-orientation={horizontal ? 'horizontal' : 'vertical'}
      onPointerDown={() => {
        dragging.current = true;
      }}
      sx={{
        flexShrink: 0,
        cursor: horizontal ? 'row-resize' : 'col-resize',
        width: horizontal ? '100%' : 6,
        height: horizontal ? 6 : '100%',
        bgcolor: 'divider',
        '&:hover': { bgcolor: 'primary.main' },
        touchAction: 'none'
      }}
    />
  );
}
