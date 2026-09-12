import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ExportSquare } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

type Props = {
  titleId: string;
  /** Where the credentials are issued. Omitted when the provider has no self-service page to send anyone to. */
  link?: { labelId: string; href: string };
};

/**
 * One group of credentials on an account that holds more than one: what they are, and where they are issued.
 *
 * <p>An account needs this when two different things are signed in to behind one provider - BrickLink's store API
 * beside its store pages, Latvijas Pasts's shipping API beside its self-service sign-in.
 */
export default function CredentialSectionHeader({ titleId, link }: Props) {
  const intl = useIntl();

  return (
    <Stack
      direction="row"
      alignItems="baseline"
      justifyContent="space-between"
      sx={{ pt: 1, pb: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Typography variant="subtitle2">{intl.formatMessage({ id: titleId })}</Typography>
      {link && (
        <Link
          href={link.href}
          target="_blank"
          rel="noopener"
          variant="caption"
          underline="hover"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
        >
          {intl.formatMessage({ id: link.labelId })}
          <ExportSquare size={13} />
        </Link>
      )}
    </Stack>
  );
}
