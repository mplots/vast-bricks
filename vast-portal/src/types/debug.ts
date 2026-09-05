/** One recorded round trip between the Vast backend and a provider. */
export interface DebugExchange {
  id: number;
  /** When the backend recorded it, as an ISO instant. */
  recordedAt: string;
  /** The provider the client named itself as, e.g. `BrickOwl`. */
  provider: string;
  method: string;
  /** Request URL, with the client's secrets masked. */
  url: string;
  requestBody: string | null;
  statusCode: number;
  responseBody: string | null;
  durationMillis: number;
  /** A body longer than the backend's cap was cut short. */
  truncated: boolean;
}

export interface DebugRecording {
  recording: boolean;
  /** When recording stops by itself, or null when it is not running. */
  recordingUntil: string | null;
}

export interface DebugExchangePage {
  exchanges: DebugExchange[];
  /** Pass back as `afterId` to get what was recorded next. */
  nextCursor: number | null;
  /** More was already waiting, so keep reading instead of waiting for the next poll. */
  more: boolean;
}

/** Where the dock sits. It displaces the page rather than covering it. */
export type DebugDockSide = 'left' | 'right' | 'bottom';

export interface DebugDockState {
  open: boolean;
  side: DebugDockSide;
  /** Width when docked to a side, height when docked to the bottom, in pixels. */
  size: number;
  /** Which panel is showing. The dock grows by adding panels, so this is not a closed set. */
  panel: string;
}
