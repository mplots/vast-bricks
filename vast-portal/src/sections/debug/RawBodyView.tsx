import { useMemo, useState } from 'react';

// material-ui
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// third-party
import copy from 'copy-to-clipboard';
import { useIntl } from 'react-intl';

// project-imports
import IconButton from 'components/@extended/IconButton';
import SyntaxHighlight from 'utils/SyntaxHighlight';
import { Copy, TickCircle } from 'iconsax-reactjs';

import { byteLength, detectLanguage, formatBody, formatBytes, maxHighlightedLength } from './providerTraffic';

type Props = {
  /** The section heading, already translated. */
  title: string;
  body: string | null;
  /** Shown in place of the body when the call carried none. */
  emptyMessage: string;
};

/**
 * One request or response body, laid out and coloured.
 *
 * <p>It carries no find of its own: the whole body is in the page, so the browser's own search reaches it, which is
 * what people use anyway.
 */
export default function RawBodyView({ title, body, emptyMessage }: Props) {
  const intl = useIntl();
  const [copied, setCopied] = useState(false);

  const language = useMemo(() => (body ? detectLanguage(body) : 'plaintext'), [body]);
  const formatted = useMemo(() => (body ? formatBody(body, language) : ''), [body, language]);
  const tooLarge = formatted.length > maxHighlightedLength;

  const handleCopy = () => {
    if (!body) return;
    // What is copied is the body as it arrived, not the indented rendering of it.
    copy(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Stack sx={{ px: 3, py: 2.5, gap: 1 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'baseline' }}>
          <Typography variant="subtitle1">{title}</Typography>
          {body && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {formatBytes(byteLength(body))}
            </Typography>
          )}
        </Stack>
        {body && (
          <Tooltip title={intl.formatMessage({ id: copied ? 'debug-body-copied' : 'debug-body-copy' })} placement="top-end">
            <IconButton color={copied ? 'success' : 'secondary'} size="small" onClick={handleCopy}>
              {copied ? <TickCircle size={18} /> : <Copy size={18} />}
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {!body && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {emptyMessage}
        </Typography>
      )}

      {body && tooLarge && (
        <>
          <Typography variant="caption" sx={{ color: 'warning.dark' }}>
            {intl.formatMessage({ id: 'debug-body-too-large' })}
          </Typography>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'secondary.lighter',
              fontSize: '0.75rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {formatted}
          </Box>
        </>
      )}

      {body && !tooLarge && (
        <Box sx={{ borderRadius: 1, '& pre': { borderRadius: 1, fontSize: '0.75rem' } }}>
          <SyntaxHighlight language={language} customStyle={{ margin: 0 }}>
            {formatted}
          </SyntaxHighlight>
        </Box>
      )}
    </Stack>
  );
}
