import { useRef, useState, type DragEvent } from 'react';

import type { SxProps, Theme } from '@mui/material/styles';

import { ThemeDirection } from 'config';
import useConfig from 'hooks/useConfig';

/** Everything a column heading needs to be picked up, dropped on, and to say where a drop would land. */
export interface ColumnDragProps {
  draggable: boolean;
  onDragStart: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent) => void;
  onDragEnd: () => void;
  sx: SxProps<Theme>;
}

/** `dragged` taken out of `columns` and put back beside `target`, on the side the pointer was nearest. */
const dropped = (columns: string[], dragged: string, target: string, after: boolean) => {
  const rest = columns.filter((column) => column !== dragged);
  const at = rest.indexOf(target) + (after ? 1 : 0);
  return [...rest.slice(0, at), dragged, ...rest.slice(at)];
};

/**
 * Dragging a table's columns by their own headings, which is where a reader's hand goes first: the panel is for
 * choosing what is read, and this is for arranging what already is. The two settle the same order, so a column moved
 * here has moved in the panel too.
 *
 * <p>The heading being dropped on draws the edge the column would land against rather than the table reordering
 * itself under the pointer: a month is hundreds of rows, and shuffling every one of them at each twitch of a drag
 * would answer slower than the hand moves. The edge is a logical one, so it is drawn on the side the reader reads
 * towards whichever way the app is written.
 */
export default function useColumnDrag(columns: string[], onReorder: (columns: string[]) => void) {
  const { themeDirection } = useConfig();
  // What is being carried is read back inside the drag's own events, which arrive faster than a render: a heading
  // that asked state whether a drag was on could refuse the drop that ends it. The state beside it is for the eye.
  const carried = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  // The heading under the pointer and which of its edges the column would land against.
  const [over, setOver] = useState<{ column: string; after: boolean } | null>(null);

  /** Which side of a heading the pointer is nearest, in the direction the app is read. */
  const side = (event: DragEvent) => {
    const box = event.currentTarget.getBoundingClientRect();
    const past = event.clientX > box.left + box.width / 2;
    // Past the middle is the far side of the heading, which is its right in a left-to-right app and its left in a
    // right-to-left one.
    return themeDirection === ThemeDirection.RTL ? !past : past;
  };

  const rest = () => {
    carried.current = null;
    setDragging(null);
    setOver(null);
  };

  return (column: string): ColumnDragProps => {
    // The edge this heading draws, if the column being carried would land against it.
    const edge =
      over && over.column === column && dragging && dragging !== column ? (over.after ? 'borderInlineEnd' : 'borderInlineStart') : null;

    return {
      draggable: true,
      onDragStart: (event) => {
        carried.current = column;
        setDragging(column);
        event.dataTransfer.effectAllowed = 'move';
        // Firefox starts no drag at all without something to carry, however little the table itself reads back.
        event.dataTransfer.setData('text/plain', column);
      },
      onDragOver: (event) => {
        if (!dragging || dragging === column) {
          return;
        }
        // Without this the drop is refused.
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const box = event.currentTarget.getBoundingClientRect();
        const past = event.clientX > box.left + box.width / 2;
        // Past the middle is the far side of the heading, which is its right in a left-to-right app and its left in
        // a right-to-left one.
        const after = themeDirection === ThemeDirection.RTL ? !past : past;
        // Dragging fires as fast as the pointer moves, and a table is hundreds of rows: nothing is said again.
        setOver((current) => (current?.column === column && current.after === after ? current : { column, after }));
      },
      onDragLeave: () => setOver((current) => (current?.column === column ? null : current)),
      onDrop: (event) => {
        event.preventDefault();
        // Where it lands is read from the drop itself rather than from what the last dragover managed to record:
        // the two events can arrive between one render and the next, and the drop is the one that decides.
        if (carried.current && carried.current !== column) {
          onReorder(dropped(columns, carried.current, column, side(event)));
        }
        rest();
      },
      onDragEnd: rest,
      sx: {
        cursor: 'grab',
        // A heading is words, and dragging words selects them; the drag is what this heading is for.
        userSelect: 'none',
        ...(dragging === column && { opacity: 0.5 }),
        ...(edge && { [edge]: (theme: Theme) => `2px solid ${theme.palette.primary.main}` })
      }
    };
  };
}
