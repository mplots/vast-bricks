import { CSSProperties } from 'react';

// material-ui
import { useTheme } from '@mui/material/styles';

// third-party
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml';
import plaintext from 'react-syntax-highlighter/dist/esm/languages/hljs/plaintext';
import { a11yDark, a11yLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// project-imports
import { ThemeMode } from 'config';

export type HighlightLanguage = 'json' | 'xml' | 'plaintext';

// The light build carries no languages of its own, so only the ones a provider actually answers with are registered.
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('xml', xml);
SyntaxHighlighter.registerLanguage('plaintext', plaintext);

// ==============================|| CODE HIGHLIGHTER ||============================== //

export default function SyntaxHighlight({
  children,
  language = 'json',
  customStyle,
  ...others
}: {
  children: string;
  language?: HighlightLanguage;
  customStyle?: CSSProperties;
}) {
  const theme = useTheme();

  return (
    <SyntaxHighlighter
      language={language}
      style={theme.palette.mode === ThemeMode.DARK ? a11yDark : a11yLight}
      customStyle={customStyle}
      wrapLongLines
      {...others}
    >
      {children}
    </SyntaxHighlighter>
  );
}
