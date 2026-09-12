import { useRef } from 'react';

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { addDays, format, isValid, parseISO } from 'date-fns';
import { Add, HamburgerMenu, Trash } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import IconButton from 'components/@extended/IconButton';
import { overlappingPeriodIndexes } from './operatingPeriodOverlap';
import type { OperatingPeriod } from 'types/providerAccount';

type Props = {
  value: OperatingPeriod[];
  onChange: (periods: OperatingPeriod[]) => void;
};

/** The picker hands back whatever has been typed so far, so a date only counts once it is a real one. */
const toIsoDate = (picked: Date | null) => (picked && isValid(picked) ? format(picked, 'yyyy-MM-dd') : null);
const shiftedBy = (iso: string, days: number) => addDays(parseISO(iso), days);

/**
 * Where a row added at the end begins: the day after the period above it ends, so it arrives already dated, already
 * inside the gap left to it, and in need of nothing before it is a period. Only a period above that never said when
 * it ended leaves nothing to follow on from, and that row arrives blank.
 */
function periodAfter(periods: OperatingPeriod[]): OperatingPeriod {
  const last = periods[periods.length - 1];
  return { from: last?.to ? format(shiftedBy(last.to, 1), 'yyyy-MM-dd') : null, to: null, note: null };
}

/**
 * The periods of an account's data that count, as every provider's form needs them: the same list whatever the
 * provider, because what an account holds junk from has nothing to do with who holds it.
 *
 * <p>Two dates rather than a range, because either end may be left unstated - a period that was already running
 * before records, or one still running - and an empty field says that on its own.
 *
 * <p>An overlap is not refused here, it is not offered: a row may only be dated inside the gap its neighbours
 * leave it, so the list is built in order and a period cannot be drawn over the one above or below it. Which gap a
 * row sits in is what dragging it changes - a period that belongs earlier is added at the end and then moved up,
 * and its dates open up as it lands. The server sorts by date on save, which for periods that cannot overlap is
 * the order they are already in.
 */
export default function OperatingPeriodsEditor({ value, onChange }: Props) {
  const intl = useIntl();
  const clashing = overlappingPeriodIndexes(value);

  // A drag needs each row to be known by something other than where it sits, which is the one thing about to
  // change. Ids are handed out as rows appear and travel with them, so dnd-kit follows a row rather than a slot.
  const ids = useRef<number[]>([]);
  const handedOut = useRef(0);
  while (ids.current.length < value.length) {
    ids.current.push(handedOut.current++);
  }
  ids.current.length = value.length;

  // A small drag threshold, so a press that never moves stays a click for the fields on the handle's own row.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const replace = (index: number, period: Partial<OperatingPeriod>) =>
    onChange(value.map((existing, at) => (at === index ? { ...existing, ...period } : existing)));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }
    const from = ids.current.indexOf(active.id as number);
    const to = ids.current.indexOf(over.id as number);
    if (from < 0 || to < 0) {
      return;
    }
    ids.current = arrayMove(ids.current, from, to);
    onChange(arrayMove(value, from, to));
  };

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{intl.formatMessage({ id: 'provider-accounts-operating-periods' })}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {intl.formatMessage({ id: 'provider-accounts-operating-periods-hint' })}
      </Typography>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids.current} strategy={verticalListSortingStrategy}>
          <Stack spacing={1}>
            {value.map((period, index) => (
              <SortablePeriodRow
                key={ids.current[index]}
                id={ids.current[index]}
                period={period}
                previous={index > 0 ? value[index - 1] : null}
                next={index < value.length - 1 ? value[index + 1] : null}
                clashes={clashing.has(index)}
                onChange={(changed) => replace(index, changed)}
                onRemove={() => onChange(value.filter((_, at) => at !== index))}
              />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>
      {clashing.size > 0 && (
        <Typography variant="caption" color="error">
          {intl.formatMessage({ id: 'provider-accounts-operating-periods-overlap' })}
        </Typography>
      )}
      <Stack direction="row">
        <Button size="small" startIcon={<Add size={16} />} onClick={() => onChange([...value, periodAfter(value)])}>
          {intl.formatMessage({ id: 'provider-accounts-operating-periods-add' })}
        </Button>
      </Stack>
    </Stack>
  );
}

type RowProps = {
  id: number;
  period: OperatingPeriod;
  previous: OperatingPeriod | null;
  next: OperatingPeriod | null;
  clashes: boolean;
  onChange: (period: Partial<OperatingPeriod>) => void;
  onRemove: () => void;
};

/**
 * One period, dated only inside the gap its neighbours leave it.
 *
 * <p>A neighbour that has not said where it ends - or where it begins - leaves no gap to speak of rather than an
 * endless one, so this row waits instead of guessing. That is the case a period still running makes for the row
 * under it, and the row says which neighbour to settle first rather than merely offering nothing.
 */
function SortablePeriodRow({ id, period, previous, next, clashes, onChange, onRemove }: RowProps) {
  const intl = useIntl();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const dragLabel = intl.formatMessage({ id: 'provider-accounts-reorder' });
  const removeLabel = intl.formatMessage({ id: 'provider-accounts-operating-periods-remove' });

  // A period above that never ends leaves no gap to follow it. A row above that is merely still blank leaves the
  // whole calendar, and must, since it is about to be dated itself.
  const waiting = previous !== null && previous.from !== null && previous.to === null;
  const earliest = previous?.to ? shiftedBy(previous.to, 1) : undefined;
  const latest = next?.from ? shiftedBy(next.from, -1) : undefined;

  const datePicker = (bound: 'from' | 'to') => (
    <DatePicker
      label={intl.formatMessage({ id: `provider-accounts-operating-periods-${bound}` })}
      value={period[bound] ? parseISO(period[bound]!) : null}
      onChange={(picked) => onChange({ [bound]: toIsoDate(picked) })}
      disabled={waiting}
      minDate={bound === 'to' && period.from ? parseISO(period.from) : earliest}
      maxDate={bound === 'from' && period.to ? parseISO(period.to) : latest}
      slotProps={{ field: { clearable: true }, textField: { size: 'small', error: clashes, sx: { width: 190 } } }}
    />
  );

  return (
    <Stack ref={setNodeRef} sx={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Tooltip title={dragLabel}>
          <IconButton
            ref={setActivatorNodeRef}
            color="secondary"
            aria-label={dragLabel}
            sx={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
            {...attributes}
            {...listeners}
          >
            <HamburgerMenu size={18} />
          </IconButton>
        </Tooltip>
        {datePicker('from')}
        {datePicker('to')}
        <TextField
          label={intl.formatMessage({ id: 'provider-accounts-operating-periods-note' })}
          value={period.note ?? ''}
          onChange={(event) => onChange({ note: event.target.value || null })}
          size="small"
          sx={{ flex: 1 }}
        />
        <Tooltip title={removeLabel}>
          <IconButton color="error" aria-label={removeLabel} onClick={onRemove}>
            <Trash size={18} />
          </IconButton>
        </Tooltip>
      </Stack>
      {waiting && (
        <Typography variant="caption" sx={{ color: 'text.secondary', pl: 6.5 }}>
          {intl.formatMessage({ id: 'provider-accounts-operating-periods-close-above' })}
        </Typography>
      )}
    </Stack>
  );
}
