import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { HamburgerMenu } from 'iconsax-reactjs';

/** One column a table can be asked to show, in the order it is currently read in. */
export interface ColumnChoice {
  key: string;
  label: string;
}

export interface ColumnPickerProps {
  /** Every column the table can show, in the order it shows them. */
  columns: ColumnChoice[];
  /** The keys of the columns currently shown; the rest keep their place in the list without being in the table. */
  shown: string[];
  onToggle: (key: string) => void;
  /** The whole order, once a move has settled. Hidden columns are ordered too: it is where they land when shown. */
  onReorder: (keys: string[]) => void;
  /**
   * How a column says it can be dragged, and how a keyboard moves it. Interpolated with the column's own name, so
   * each handle says which column it carries.
   */
  handleLabel: (label: string) => string;
}

/** `key` moved to `to`, the rest closing up behind it and parting in front of it. */
const moved = (keys: string[], key: string, to: number) => {
  const rest = keys.filter((kept) => kept !== key);
  return [...rest.slice(0, to), key, ...rest.slice(to)];
};

/**
 * The list a table is picked and ordered from: one row per column, ticked where the table shows it, dragged by its
 * handle to where it should be read. Hiding a column does not take it out of the list — it keeps its place, so a
 * column put back comes back where it was rather than at the end of the table.
 *
 * <p>The dragging is the browser's own, no library standing behind it, and the handle answers the arrow keys as
 * well: a column that could only be moved with a mouse could not be moved by everyone.
 *
 * <p>The list knows nothing about what it is ordering: a caller states the columns and holds the choice, so a second
 * table picking its columns is this list again rather than a copy of it.
 */
export default function ColumnPicker({ columns, shown, onToggle, onReorder, handleLabel }: ColumnPickerProps) {
  // Where the columns stand mid-drag. The order is the caller's, but a drag is answered by the frame rather than by
  // a round trip through the address, so the list carries the move itself and hands over the result once it settles.
  //
  // <p>The drag's own events arrive faster than a render, so what is being carried and where it has reached are read
  // back from marks rather than from state: a row that asked state whether a drag was on could refuse the drop that
  // ends it, or hand over the order as it stood a move ago. The state beside them is what the eye follows.
  const carried = useRef<string | null>(null);
  const moving = useRef<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[] | null>(null);

  const keys = preview ?? columns.map((column) => column.key);
  const ordered = keys.flatMap((key) => columns.filter((column) => column.key === key));

  const settle = () => {
    const settled = moving.current;
    if (settled && settled.some((key, index) => columns[index]?.key !== key)) {
      onReorder(settled);
    }
    carried.current = null;
    moving.current = null;
    setDragging(null);
    setPreview(null);
  };

  const dragOver = (event: DragEvent, index: number) => {
    // Without this the drop is refused, and the row under the pointer is where the dragged column belongs.
    event.preventDefault();
    const held = carried.current;
    if (held && (moving.current ?? keys)[index] !== held) {
      const next = moved(moving.current ?? keys, held, index);
      moving.current = next;
      setPreview(next);
    }
  };

  // The arrows move a column a place at a time; the handle keeps the focus, so a column can be walked to where it
  // belongs rather than moved once per trip to it.
  const moveByKey = (event: KeyboardEvent, key: string, index: number) => {
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (!step || index + step < 0 || index + step >= keys.length) {
      return;
    }
    // The panel scrolls to the arrows otherwise, taking the row out from under the hand moving it.
    event.preventDefault();
    onReorder(moved(keys, key, index + step));
  };

  return (
    <Stack>
      {ordered.map((column, index) => (
        <Stack
          key={column.key}
          draggable
          direction="row"
          sx={{
            gap: 0.5,
            alignItems: 'center',
            borderRadius: 1,
            // The row being carried is the one the pointer is holding, so it reads as lifted off the list.
            ...(dragging === column.key && { bgcolor: 'secondary.lighter' })
          }}
          onDragStart={(event) => {
            carried.current = column.key;
            moving.current = keys;
            setDragging(column.key);
            event.dataTransfer.effectAllowed = 'move';
            // Firefox starts no drag at all without something to carry, however little the list itself reads back.
            event.dataTransfer.setData('text/plain', column.key);
          }}
          onDragOver={(event) => dragOver(event, index)}
          onDrop={(event) => {
            event.preventDefault();
            settle();
          }}
          onDragEnd={settle}
        >
          <Box
            component="span"
            role="button"
            tabIndex={0}
            aria-label={handleLabel(column.label)}
            onKeyDown={(event) => moveByKey(event, column.key, index)}
            sx={{
              display: 'inline-flex',
              p: 0.5,
              borderRadius: 1,
              color: 'text.secondary',
              cursor: 'grab',
              '&:active': { cursor: 'grabbing' }
            }}
          >
            <HamburgerMenu size={16} />
          </Box>
          <Checkbox size="small" checked={shown.includes(column.key)} onChange={() => onToggle(column.key)} />
          {/* The label is the checkbox's own, so the whole name ticks the column rather than the small box alone.
              The handle beside it is not part of that: dragging a label that also toggled would toggle on the way. */}
          <Typography
            component="label"
            variant="body1"
            sx={{ cursor: 'pointer', flexGrow: 1, py: 0.5 }}
            onClick={() => onToggle(column.key)}
          >
            {column.label}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}
