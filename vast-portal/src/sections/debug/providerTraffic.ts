import type { ChipProps } from '@mui/material/Chip';

import type { HighlightLanguage } from 'utils/SyntaxHighlight';
import type { DebugExchange } from 'types/debug';

/**
 * Each provider keeps its own chip colour. The marketplaces are coloured as the accounting screen colours them; the
 * payment and accounting providers get their own, because the dock mixes them all and colouring them alike would
 * waste the cue.
 */
const providerColors: Record<string, ChipProps['color']> = {
  BrickLink: 'primary',
  BrickOwl: 'secondary',
  PayPal: 'info',
  Stripe: 'warning',
  Manakabata: 'success'
};

/** A provider not listed still gets a colour rather than none, since the dock records whoever calls out. */
export const providerColor = (provider: string): ChipProps['color'] => providerColors[provider] ?? 'default';

/** A response is judged by its status class alone, which is all a raw call says about itself. */
export const statusColor = (statusCode: number): ChipProps['color'] => {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warning';
  return statusCode >= 200 && statusCode < 300 ? 'success' : 'info';
};

export const isFailedCall = (call: DebugExchange) => call.statusCode < 200 || call.statusCode >= 300;

/** Bytes as sent, counted from the text; a body is UTF-8 on the wire so this is what it weighed. */
export const byteLength = (body: string | null) => (body ? new TextEncoder().encode(body).length : 0);

export const callSize = (call: DebugExchange) => byteLength(call.requestBody) + byteLength(call.responseBody);

/** Total bytes a group of calls weighed, which is the summary a provider row leads with. */
export const groupSize = (calls: DebugExchange[]) => calls.reduce((total, call) => total + callSize(call), 0);

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** The path and query of a call's URL, which is what tells two calls of one provider apart. */
export const callPath = (url: string) => {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
};

/** What the body looks like, decided from the text itself: a provider states no content type here. */
export const detectLanguage = (body: string): HighlightLanguage => {
  const trimmed = body.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return trimmed.startsWith('<') ? 'xml' : 'plaintext';
};

const formatJson = (body: string) => JSON.stringify(JSON.parse(body), null, 2);

/**
 * Indents an XML document one element per line. Deliberately naive: it reads the tags, not the grammar, which is
 * enough for a provider's export and cannot fail on one that is malformed.
 */
const formatXml = (body: string) => {
  const lines = body.replace(/>\s*</g, '>\n<').split('\n');
  let depth = 0;
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('</')) {
        depth = Math.max(depth - 1, 0);
      }
      const indented = `${'  '.repeat(depth)}${trimmed}`;
      const opensElement = /^<[^!?/]/.test(trimmed) && !trimmed.endsWith('/>') && !/<\/[^>]+>$/.test(trimmed);
      if (opensElement) {
        depth += 1;
      }
      return indented;
    })
    .join('\n');
};

/**
 * The body laid out for reading. A body that will not parse is returned exactly as it arrived rather than rejected:
 * a malformed payload is precisely when someone is looking at this screen.
 */
export const formatBody = (body: string, language: HighlightLanguage) => {
  try {
    if (language === 'json') return formatJson(body);
    return language === 'xml' ? formatXml(body) : body;
  } catch {
    return body;
  }
};

/** How long a call took, in the unit that keeps it short to read, the way sizes step from bytes to kilobytes. */
export const formatDuration = (millis: number) => {
  if (millis < 1000) {
    return `${millis} ms`;
  }
  return millis < 60_000 ? `${(millis / 1000).toFixed(1)} s` : `${(millis / 60_000).toFixed(1)} min`;
};

/** The time a call was recorded, to the millisecond, which is what orders two calls made in the same second. */
export const formatTime = (recordedAt: string) => {
  const at = new Date(recordedAt);
  if (Number.isNaN(at.getTime())) {
    return recordedAt;
  }
  return `${at.toLocaleTimeString(undefined, { hour12: false })}.${String(at.getMilliseconds()).padStart(3, '0')}`;
};

/** Colouring a payload this size janks the page, so past it the body is shown as plain text. */
export const maxHighlightedLength = 200_000;
