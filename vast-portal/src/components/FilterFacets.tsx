import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Checkbox, { CheckboxProps } from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/** One value a facet can be narrowed to, with how many of the records still answer it. */
export interface FilterOption {
  value: string;
  label: string;
  count: number;
  /** Shown before the label where the value reads better as a mark, as a tax type does. */
  icon?: ReactNode;
  /** The value's own colour, where it has one; otherwise the box reads as primary. */
  color?: CheckboxProps['color'];
}

/** One thing the records can be narrowed by. */
export interface FilterFacet {
  key: string;
  label: string;
  options: FilterOption[];
}

/** Selected values per facet key. A facet with none selected narrows nothing. */
export type FilterSelection = Record<string, string[]>;

export interface FilterFacetsProps {
  facets: FilterFacet[];
  selection: FilterSelection;
  onToggle: (facetKey: string, value: string) => void;
}

/**
 * The facets a shop stacks down its filter panel: one headed group per thing the records can be narrowed by, each a
 * column of checkboxes with the count still answering each value. Ticking several values of one group widens that
 * group and ticking across groups narrows, which is what the counts say, so a facet's counts are of the records the
 * other facets already let through.
 *
 * <p>The list knows nothing about what it is filtering: a caller states the groups and holds the selection, so adding
 * a filter is one more group rather than a change here.
 */
export default function FilterFacets({ facets, selection, onToggle }: FilterFacetsProps) {
  const isSelected = (facetKey: string, value: string) => (selection[facetKey] ?? []).includes(value);

  return (
    <Stack sx={{ gap: 2.5 }}>
      {facets.map((facet) => (
        <Stack key={facet.key}>
          <Typography variant="h5">{facet.label}</Typography>
          <Box sx={{ pl: 0.5 }}>
            <Stack>
              {facet.options.map((option) => {
                const selected = isSelected(facet.key, option.value);
                return (
                  <FormControlLabel
                    key={option.value}
                    control={
                      <Checkbox
                        size="small"
                        color={option.color ?? 'primary'}
                        checked={selected}
                        // Nothing is left of it under the other facets, so ticking it could only add nothing.
                        disabled={option.count === 0 && !selected}
                        onChange={() => onToggle(facet.key, option.value)}
                      />
                    }
                    label={
                      <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center' }}>
                        {option.icon}
                        {/* The count runs on in the same text flow, so a label too long for the panel wraps with its
                            count after the last word rather than leaving it stranded beside two lines. */}
                        <span>
                          {option.label}{' '}
                          <Typography component="span" variant="body2" color="text.secondary">
                            ({option.count})
                          </Typography>
                        </span>
                      </Stack>
                    }
                  />
                );
              })}
            </Stack>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}
