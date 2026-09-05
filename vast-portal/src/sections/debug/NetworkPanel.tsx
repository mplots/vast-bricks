import { useMemo, useState } from 'react';

// material-ui
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// third-party
import { useIntl } from 'react-intl';

// project-imports
import IconButton from 'components/@extended/IconButton';
import hasTextSelection from 'utils/textSelection';
import type { DebugExchange } from 'types/debug';
import { ArrowLeft2, Clock, Layer, Record, Refresh, Stop, Trash } from 'iconsax-reactjs';

import RawBodyView from './RawBodyView';
import useDebugHttp from './useDebugHttp';
import {
  callPath,
  callSize,
  formatBytes,
  formatDuration,
  formatTime,
  groupSize,
  isFailedCall,
  providerColor,
  statusColor
} from './providerTraffic';

/** How the calls are ordered: as they happened, or gathered under the provider that answered them. */
type NetworkView = 'time' | 'provider';

/**
 * What the backend sent to providers and what came back, for this user's own requests.
 *
 * <p>Two ways to read it: by time, which is the only way to see one provider's call land between another's, or by
 * provider, which is what you want when chasing one provider's protocol. Either way the newest call is at the top.
 * Nothing is recorded until Record is pressed, Reload re-reads everything stored, and Clear deletes it, because the
 * bodies hold whatever the provider sent.
 */
export default function NetworkPanel() {
  const intl = useIntl();
  const { recording, exchanges, error, toggleRecording, reload, clear } = useDebugHttp();
  const [view, setView] = useState<NetworkView>('time');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Grouped in the order each provider was first heard from, so the list does not reshuffle as calls arrive.
  const groups = useMemo(() => {
    const byProvider = new Map<string, DebugExchange[]>();
    exchanges.forEach((exchange) => {
      const group = byProvider.get(exchange.provider);
      if (group) {
        group.push(exchange);
      } else {
        byProvider.set(exchange.provider, [exchange]);
      }
    });
    return [...byProvider.entries()].map(([provider, calls]) => ({ provider, calls }));
  }, [exchanges]);

  const call = exchanges.find((exchange) => exchange.id === selectedId) ?? null;
  const group = view === 'provider' ? (groups.find((candidate) => candidate.provider === selectedProvider) ?? null) : null;
  // Newest first: the call you just made is the one you opened the panel for, so it should not be a scroll away.
  const listed = useMemo(() => [...(group ? group.calls : exchanges)].reverse(), [group, exchanges]);

  const showsProviders = view === 'provider' && !group;
  const goBack = () => (call ? setSelectedId(null) : setSelectedProvider(null));
  const backLabel = intl.formatMessage({
    id: call && view === 'provider' ? 'debug-network-back-calls' : 'debug-network-back-providers'
  });

  const changeView = (next: NetworkView | null) => {
    if (!next) return;
    setView(next);
    setSelectedProvider(null);
    setSelectedId(null);
  };

  const handleClear = () => {
    setSelectedProvider(null);
    setSelectedId(null);
    void clear();
  };

  return (
    <Stack sx={{ height: 1, minHeight: 0 }}>
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', px: 2, py: 1, flexShrink: 0, flexWrap: 'wrap' }}>
        {(call || group) && (
          <Tooltip title={backLabel}>
            <IconButton color="secondary" size="small" aria-label={backLabel} onClick={goBack}>
              <ArrowLeft2 size={16} />
            </IconButton>
          </Tooltip>
        )}

        <ToggleButtonGroup exclusive size="small" value={view} onChange={(_event, next: NetworkView | null) => changeView(next)}>
          <ToggleButton value="time" sx={{ px: 1, py: 0.25 }}>
            <Tooltip title={intl.formatMessage({ id: 'debug-network-by-time' })}>
              <Clock size={16} />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="provider" sx={{ px: 1, py: 0.25 }}>
            <Tooltip title={intl.formatMessage({ id: 'debug-network-by-provider' })}>
              <Layer size={16} />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Button
          size="small"
          variant={recording ? 'contained' : 'outlined'}
          color={recording ? 'error' : 'primary'}
          startIcon={recording ? <Stop size={16} /> : <Record size={16} />}
          onClick={() => void toggleRecording()}
        >
          {intl.formatMessage({ id: recording ? 'debug-network-stop' : 'debug-network-record' })}
        </Button>

        <Tooltip title={intl.formatMessage({ id: 'debug-network-reload' })}>
          <IconButton
            size="small"
            color="secondary"
            aria-label={intl.formatMessage({ id: 'debug-network-reload' })}
            onClick={() => void reload()}
          >
            <Refresh size={16} />
          </IconButton>
        </Tooltip>

        <Button size="small" color="secondary" startIcon={<Trash size={16} />} onClick={handleClear} disabled={!exchanges.length}>
          {intl.formatMessage({ id: 'debug-network-clear' })}
        </Button>

        {/* What is stored for this user right now, so the panel says what a Clear would delete. */}
        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
          {intl.formatMessage({ id: 'debug-network-count' }, { count: exchanges.length })}
          {exchanges.length > 0 && ` · ${formatBytes(groupSize(exchanges))}`}
        </Typography>
      </Stack>

      {call && (
        <>
          <Divider />
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center', px: 2, py: 1, minWidth: 0, flexShrink: 0 }}>
            <Chip label={call.provider} size="small" color={providerColor(call.provider)} variant="outlined" />
            <Chip label={call.method} size="small" color="primary" variant="light" />
            <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {call.url}
            </Typography>
            <Chip label={call.statusCode} size="small" color={statusColor(call.statusCode)} variant="light" />
            <Chip label={formatDuration(call.durationMillis)} size="small" variant="outlined" />
          </Stack>
        </>
      )}
      <Divider />

      {error && (
        <Alert severity="error" sx={{ m: 1 }}>
          {error}
        </Alert>
      )}

      {/* One scroll container for the whole panel. SimpleBar wraps its content in a scroller of its own, which inside
          this flex column left the panel with two scrollbars side by side. */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {!exchanges.length && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {intl.formatMessage({ id: recording ? 'debug-network-recording-empty' : 'debug-network-empty' })}
            </Typography>
          </Box>
        )}

        {!call && showsProviders && (
          <List disablePadding>
            {groups.map((candidate) => {
              const failed = candidate.calls.filter(isFailedCall).length;
              return (
                <ListItemButton
                  key={candidate.provider}
                  divider
                  onClick={() => !hasTextSelection() && setSelectedProvider(candidate.provider)}
                  sx={{ px: 2 }}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                        <Chip label={candidate.provider} size="small" color={providerColor(candidate.provider)} variant="outlined" />
                        {/* The count is named as well as coloured, so a failure does not rely on colour alone. */}
                        {failed > 0 && (
                          <Chip
                            label={intl.formatMessage({ id: 'debug-network-failed' }, { count: failed })}
                            size="small"
                            color="error"
                            variant="light"
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {intl.formatMessage({ id: 'debug-network-calls' }, { count: candidate.calls.length })}
                        {' · '}
                        {formatBytes(groupSize(candidate.calls))}
                      </Typography>
                    }
                    slotProps={{ primary: { component: 'div' }, secondary: { component: 'div' } }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        )}

        {!call && !showsProviders && (
          <List disablePadding>
            {listed.map((candidate) => (
              <ListItemButton key={candidate.id} divider onClick={() => !hasTextSelection() && setSelectedId(candidate.id)} sx={{ px: 2 }}>
                <ListItemText
                  primary={
                    <Stack direction="row" sx={{ gap: 1, alignItems: 'center', minWidth: 0 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                        {formatTime(candidate.recordedAt)}
                      </Typography>
                      {/* Only the time view mixes providers, so only there does a row need to name one. */}
                      {view === 'time' && (
                        <Chip label={candidate.provider} size="small" color={providerColor(candidate.provider)} variant="outlined" />
                      )}
                      <Chip label={candidate.method} size="small" color="primary" variant="light" />
                      <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {callPath(candidate.url)}
                      </Typography>
                    </Stack>
                  }
                  secondary={
                    <Stack direction="row" sx={{ gap: 1, alignItems: 'center', mt: 0.5 }}>
                      <Chip label={candidate.statusCode} size="small" color={statusColor(candidate.statusCode)} variant="light" />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatBytes(callSize(candidate))} · {formatDuration(candidate.durationMillis)}
                      </Typography>
                    </Stack>
                  }
                  slotProps={{ secondary: { component: 'div' } }}
                />
              </ListItemButton>
            ))}
          </List>
        )}

        {call && (
          <>
            {call.truncated && (
              <Alert severity="info" sx={{ m: 1 }}>
                {intl.formatMessage({ id: 'debug-network-truncated' })}
              </Alert>
            )}
            <RawBodyView
              title={intl.formatMessage({ id: 'debug-network-request' })}
              body={call.requestBody}
              emptyMessage={intl.formatMessage({ id: 'debug-network-no-request-body' })}
            />
            <Divider />
            <RawBodyView
              title={intl.formatMessage({ id: 'debug-network-response' })}
              body={call.responseBody}
              emptyMessage={intl.formatMessage({ id: 'debug-network-no-response-body' })}
            />
          </>
        )}
      </Box>
    </Stack>
  );
}
