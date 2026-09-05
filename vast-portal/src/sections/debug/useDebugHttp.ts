import { useCallback, useEffect, useRef, useState } from 'react';

// project-imports
import { clearExchanges, getExchanges, getRecording, rememberRecording, setRecording, wasRecording } from 'api/debug';
import type { DebugExchange } from 'types/debug';

/** How often the panel asks for what was recorded since its cursor. */
const POLL_INTERVAL = 1000;

/**
 * The network panel's data: whether this user is recording, and everything recorded so far.
 *
 * <p>The backend pages, so a poll keeps reading while it says more is waiting rather than dribbling one page per
 * second. The cursor lives in a ref because the poll closes over it and must always see the latest.
 *
 * <p>Recording is tied to the panel being open: closing it stops recording, so nothing is written while nobody is
 * watching, and reopening resumes it if that is how it was left.
 */
export default function useDebugHttp() {
  const [recording, setRecordingState] = useState(false);
  const [recordingUntil, setRecordingUntil] = useState<string | null>(null);
  const [exchanges, setExchanges] = useState<DebugExchange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cursor = useRef<number | null>(null);
  // The unmount cleanup runs once and would otherwise close over whatever `recording` was when it was created.
  const isRecording = useRef(false);

  useEffect(() => {
    isRecording.current = recording;
  }, [recording]);

  const read = useCallback(async () => {
    try {
      for (;;) {
        const page = await getExchanges(cursor.current);
        if (page.exchanges.length) {
          cursor.current = page.nextCursor;
          setExchanges((current) => [...current, ...page.exchanges]);
        }
        if (!page.more) {
          return;
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  // Resume if that is how the panel was left, and otherwise report whatever the backend says is armed. Either way
  // what is already stored is shown, so a recording made before the panel was opened is not lost.
  useEffect(() => {
    const opening = wasRecording() ? setRecording(true) : getRecording();
    opening
      .then((state) => {
        setRecordingState(state.recording);
        setRecordingUntil(state.recordingUntil);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)));
    void read();
  }, [read]);

  // Closing the panel stops recording, and remembers whether it was running so reopening can pick it back up.
  useEffect(
    () => () => {
      rememberRecording(isRecording.current);
      if (isRecording.current) {
        void setRecording(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!recording) {
      return;
    }
    const timer = setInterval(() => void read(), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [recording, read]);

  const toggleRecording = useCallback(async () => {
    setError(null);
    try {
      const state = await setRecording(!recording);
      setRecordingState(state.recording);
      setRecordingUntil(state.recordingUntil);
      if (state.recording) {
        void read();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [recording, read]);

  /** Re-reads everything stored for this user, in case rows were recorded while the panel was not open. */
  const reload = useCallback(async () => {
    setError(null);
    cursor.current = null;
    setExchanges([]);
    await read();
  }, [read]);

  const clear = useCallback(async () => {
    setError(null);
    try {
      await clearExchanges();
      cursor.current = null;
      setExchanges([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  return { recording, recordingUntil, exchanges, error, toggleRecording, reload, clear };
}
