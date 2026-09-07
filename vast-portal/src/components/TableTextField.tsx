import type { KeyboardEvent, ReactNode } from 'react';

import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';

export interface TableTextFieldProps {
  value: string;
  /** What there is to type here, which is the only thing a field at rest says about itself. */
  placeholder: string;
  ariaLabel: string;
  /**
   * A mark before the text saying what kind of field this is, where it has one: the search fields carry a magnifier,
   * the mapping carries nothing, an icon standing in every row of a period being noise rather than a cue. It is the
   * one thing the fields are allowed to differ in — the field itself stays one style.
   */
  icon?: ReactNode;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * The one field a ledger table is typed in, wherever that is: the mapping written against a bank entry, and the
 * search asked of a column in the head. They are one style rather than two because a reader meets them in the same
 * table, and on neighbouring screens, and a second look would read as a second kind of control.
 *
 * <p>A line under the text and no box around it: a box drawn in every searchable column read heavier than the
 * headings it was asking about. The line answers a hand in three steps. At rest it is under the divider's own weight
 * but plainly there, saying a field is here to a reader pointing at nothing; a hand anywhere on the row brings it up
 * to that weight; and pointing at the field itself sweeps a line in over it in the accent colour, the way the focused
 * field's own line arrives, one pixel to the focused line's two. At full weight under every row of a period the
 * resting line would be another rung of the ladder this table was deliberately rid of; held under it, it sits well
 * below the two rules that carry the table's shape.
 */
export default function TableTextField({
  value,
  placeholder,
  ariaLabel,
  icon,
  disabled,
  onChange,
  onBlur,
  onKeyDown
}: TableTextFieldProps) {
  return (
    <TextField
      fullWidth
      size="small"
      variant="standard"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      slotProps={{
        htmlInput: { 'aria-label': ariaLabel },
        input: {
          startAdornment: icon ? (
            // Quieter than the text it stands before: it says what the field is for, and the reader is looking at
            // what they typed. The label already says the same thing in words, so nothing rests on the mark alone.
            <InputAdornment position="start" sx={{ mr: 0.75, color: 'text.secondary' }}>
              {icon}
            </InputAdornment>
          ) : undefined
        }
      }}
      sx={(theme) => ({
        // The line is there at rest, under the divider's own weight but plainly there: it has to say a field is here
        // to a reader who is not pointing at anything. It can afford to be read at rest because the weight is no
        // longer what marks a hovered field — the sweep below is — so the two states no longer have to be told apart
        // by how faint one of them is. Faded by the line's own opacity rather than by a paler colour, so the one
        // number covers both themes: the divider is already a transparent colour, and setting a second alpha over it
        // would read fainter in one and louder in the other.
        '& .MuiInput-root:before': {
          borderBottomColor: theme.palette.divider,
          opacity: 0.6,
          transition: theme.transitions.create('opacity', { duration: theme.transitions.duration.shortest })
        },
        'tr:hover & .MuiInput-root:before, & .MuiInput-root.Mui-focused:before': { opacity: 1 },
        // Pointing straight at the field draws the line at full weight and no further. Left alone, a hovered standard
        // input doubles its line and darkens it to the text's own colour, which reads heavier than the rule under the
        // head — a hand resting on a field is not a change in the table.
        '& .MuiInput-root:hover:not(.Mui-disabled, .Mui-error):before': {
          borderBottom: `1px solid ${theme.palette.divider}`,
          opacity: 1
        },
        // And it sweeps in the same way a focused field's line does, that being the same act one step earlier: the
        // sweep is the line MUI draws over the resting one on focus, so hovering borrows it and focusing then has
        // somewhere louder to go. Its own transition does the animating; only the end of it is stated here.
        //
        // <p>It arrives in the accent colour and stays one pixel thick. Swept in at the divider's own colour it was
        // an animation nobody could see: it landed on a resting line of the same weight and colour, so there was
        // nothing to watch arrive. The colour is what makes the sweep read, and the thickness is what keeps a hovered
        // field quieter than a focused one, which draws the same accent at two.
        //
        // <p>Not while the field is focused: this rule out-specifies the focused one, so a mouse resting on a field
        // being typed in would otherwise pull its line back down to a single pixel.
        '& .MuiInput-root:hover:not(.Mui-disabled, .Mui-error, .Mui-focused):after': {
          borderBottom: `1px solid ${theme.palette.primary.main}`,
          transform: 'scaleX(1) translateX(0)'
        },
        // The line is drawn along the bottom of the whole field, so the room above it is made here rather than on the
        // text: padding on the input alone leaves the mark beside it sitting on the line, the mark being the input's
        // sibling rather than inside it.
        '& .MuiInput-root': { pb: 0.5 },
        // The head is set in bold uppercase and both are inherited, so a field in the search row would wear them and
        // read as a heading rather than as something to type in. Stated here rather than there: it is the same field.
        '& .MuiInputBase-input': { textTransform: 'none', fontWeight: 400, py: 0.25 }
      })}
    />
  );
}
