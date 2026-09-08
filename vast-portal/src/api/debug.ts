import { useMemo } from 'react';

// third-party
import useSWR, { mutate } from 'swr';

// project-imports
import axios from 'utils/axios';
import type { DebugBodySide, DebugDockSide, DebugDockState, DebugExchangePage, DebugRecording } from 'types/debug';

const endpoint = '/api/private/debug/http';
const dockKey = 'api/debug/dock';
const storageKey = 'vast-debug-dock';
const resumeKey = 'vast-debug-resume-recording';

export const minDockSize = 280;

const defaultDock: DebugDockState = { open: false, side: 'bottom', size: 380, panel: 'network' };

/**
 * Where the dock was left. Reading it can throw outright in a browser that blocks site data, so a failure just means
 * the default rather than a broken app shell.
 */
const readDock = (): DebugDockState => {
  try {
    const stored = window.localStorage.getItem(storageKey);
    const parsed = stored ? (JSON.parse(stored) as Partial<DebugDockState>) : {};
    // The dock is never restored open: it is a tool you reach for, not a thing that greets you.
    return { ...defaultDock, ...parsed, open: false };
  } catch {
    return defaultDock;
  }
};

const writeDock = (dock: DebugDockState) => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(dock));
  } catch {
    // Where the dock sits is a convenience; a browser that will not store it costs nothing.
  }
};

// ==============================|| API - DEBUG DOCK ||============================== //

export function useDebugDock() {
  const { data } = useSWR(dockKey, readDock, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });

  return useMemo(() => (data as DebugDockState) ?? defaultDock, [data]);
}

function updateDock(update: Partial<DebugDockState>) {
  mutate(
    dockKey,
    (current: DebugDockState = defaultDock) => {
      const next = { ...current, ...update };
      writeDock(next);
      return next;
    },
    false
  );
}

export const openDebugDock = () => updateDock({ open: true });
export const closeDebugDock = () => updateDock({ open: false });
export const setDebugDockSide = (side: DebugDockSide) => updateDock({ side });
export const setDebugDockSize = (size: number) => updateDock({ size: Math.max(minDockSize, Math.round(size)) });
export const setDebugPanel = (panel: string) => updateDock({ panel });

/**
 * Whether recording was running when the panel last closed.
 *
 * <p>Closing the panel stops recording, so nothing is written to the database while nobody is watching. Remembering
 * that it was on means reopening picks up where it left off instead of asking for the same click again.
 */
export function wasRecording(): boolean {
  try {
    return window.localStorage.getItem(resumeKey) === 'true';
  } catch {
    return false;
  }
}

export function rememberRecording(recording: boolean) {
  try {
    window.localStorage.setItem(resumeKey, String(recording));
  } catch {
    // Resuming is a convenience; a browser that will not store it just means one more click.
  }
}

// ==============================|| API - DEBUG HTTP ||============================== //

export async function getRecording(): Promise<DebugRecording> {
  const { data } = await axios.get<DebugRecording>(`${endpoint}/recording`);
  return data;
}

export async function setRecording(enabled: boolean): Promise<DebugRecording> {
  const { data } = await axios.post<DebugRecording>(`${endpoint}/recording`, { enabled });
  return data;
}

/** What was recorded after the cursor. The backend pages, so `more` says to keep reading now rather than next poll. */
export async function getExchanges(afterId: number | null): Promise<DebugExchangePage> {
  const query = afterId === null ? '' : `?afterId=${afterId}`;
  const { data } = await axios.get<DebugExchangePage>(`${endpoint}/exchanges${query}`);
  return data;
}

/**
 * Hands one recorded body over as the file it was.
 *
 * <p>It is fetched rather than linked to: the panel's requests carry the caller's token in a header, and a plain
 * link would arrive without it. So the bytes come back through the same client as everything else and are handed to
 * the browser as a download of their own.
 */
export async function downloadBodyFile(id: number, side: DebugBodySide, filename: string): Promise<void> {
  const { data } = await axios.get<Blob>(`${endpoint}/exchanges/${id}/${side}-body`, { responseType: 'blob' });

  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked a moment later rather than at once: a browser that has not started reading the object yet would be left
  // downloading nothing.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function clearExchanges(): Promise<void> {
  await axios.delete(`${endpoint}/exchanges`);
}
