import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { ArrowRotateLeft } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

type Props = {
  labelId: string;
  value: string;
  onChange: (value: string) => void;
  /** How long the stored secret is, 0 when none is stored. */
  storedLength: number;
};

/**
 * One secret field, as every provider's form needs it: it never shows what is stored, only how wide it is.
 *
 * <p>Typing replaces the stored secret and leaving the field alone keeps it, which is a rule better undone than
 * explained - so once something has been typed the field offers to revert to empty, and the masked placeholder
 * coming back is what says the stored secret is being kept.
 */
export default function SecretTextField({ labelId, value, onChange, storedLength }: Props) {
  const intl = useIntl();
  const revertLabel = intl.formatMessage({ id: 'provider-accounts-secret-revert' });

  return (
    <TextField
      label={intl.formatMessage({ id: labelId })}
      type="password"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={storedLength > 0 ? '•'.repeat(storedLength) : intl.formatMessage({ id: 'provider-accounts-secret-unset' })}
      slotProps={{
        inputLabel: { shrink: true },
        input: {
          endAdornment:
            value === '' ? undefined : (
              <InputAdornment position="end">
                <Tooltip title={revertLabel}>
                  <IconButton onClick={() => onChange('')} edge="end" size="small" aria-label={revertLabel}>
                    <ArrowRotateLeft size={18} />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            )
        }
      }}
      fullWidth
    />
  );
}
