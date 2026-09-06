import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/** One column a table can be asked to show. */
export interface ColumnChoice {
  key: string;
  label: string;
}

/** The columns of one source, under the name of the source that stated them. */
export interface ColumnGroup {
  key: string;
  label: string;
  columns: ColumnChoice[];
}

export interface ColumnPickerProps {
  /** Every column the table can show, grouped by where its value came from. */
  groups: ColumnGroup[];
  /** The keys of the columns currently shown. */
  shown: string[];
  onToggle: (key: string) => void;
  /** Shows or hides a whole group at once; `show` says which. */
  onToggleGroup: (keys: string[], show: boolean) => void;
  /** How a group's own tick says what it does, interpolated with the group's name. */
  groupLabel: (label: string) => string;
}

/**
 * The list a table's columns are chosen from: one group per source, and inside it one row per column, ticked where
 * the table shows it. A group is ticked as a whole too, which is how a reader asks for everything one source says
 * without ticking its fields one by one.
 *
 * <p>It chooses which columns are read and not the order they are read in. Ordering is dragging the table's own
 * headings, where a reader's hand goes first, and it has to stay there: the columns are grouped here by the account
 * that stated them, while a table is arranged so that its amounts read as the sums they make — the two orders are
 * not the same order, and a list that tried to be both could only be one of them.
 *
 * <p>The list knows nothing about what it is grouping: a caller states the groups and holds the choice, so a second
 * table picking its columns is this list again rather than a copy of it.
 */
export default function ColumnPicker({ groups, shown, onToggle, onToggleGroup, groupLabel }: ColumnPickerProps) {
  return (
    <Stack sx={{ gap: 1.5 }}>
      {groups.map((group, index) => {
        const keys = group.columns.map((column) => column.key);
        const showing = keys.filter((key) => shown.includes(key));
        return (
          <Stack key={group.key} sx={{ gap: 0.25 }}>
            {/* A group is a heading and a tick of its own: the heading says which account the columns under it come
                from, and the tick asks for all of them or none. Part of a group ticked shows as part-ticked rather
                than as ticked, so the box says what the rows below it say. */}
            <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
              <Checkbox
                size="small"
                checked={showing.length === keys.length}
                indeterminate={showing.length > 0 && showing.length < keys.length}
                inputProps={{ 'aria-label': groupLabel(group.label) }}
                onChange={() => onToggleGroup(keys, showing.length < keys.length)}
              />
              <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                {group.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {showing.length}/{keys.length}
              </Typography>
            </Stack>
            {group.columns.map((column) => (
              // Indented under the heading, which is what makes a group read as one at a glance rather than as a
              // caption repeated down every row.
              <Stack key={column.key} direction="row" sx={{ gap: 0.5, alignItems: 'center', pl: 2.5 }}>
                <Checkbox size="small" checked={shown.includes(column.key)} onChange={() => onToggle(column.key)} />
                {/* The label is the checkbox's own, so the whole name ticks the column rather than the small box. */}
                <Typography
                  component="label"
                  variant="body2"
                  sx={{ cursor: 'pointer', flexGrow: 1, py: 0.25 }}
                  onClick={() => onToggle(column.key)}
                >
                  {column.label}
                </Typography>
              </Stack>
            ))}
            {index < groups.length - 1 && <Divider sx={{ mt: 1.25 }} />}
          </Stack>
        );
      })}
    </Stack>
  );
}
