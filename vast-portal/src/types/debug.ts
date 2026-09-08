/**
 * A body the backend kept as a file rather than as text, and what downloading it hands over.
 *
 * <p>Not every provider answers in text: an export hands over a spreadsheet, a label a PDF. The body itself then
 * carries a note of what it was, and this is what the panel offers beside it.
 */
export interface DebugBodyFile {
  /** What the provider called it, which is what the download is served as. */
  contentType: string | null;
  size: number;
  /** What it is saved as: the provider, the exchange, which side of it, and the extension for its type. */
  filename: string;
}

/** Which side of an exchange a body belongs to, which is what its download is addressed by. */
export type DebugBodySide = 'request' | 'response';

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
  /** The body as text, or the note standing in for one kept as a file. */
  requestBody: string | null;
  /** What downloading the request body would hand over, or null when there is no file to download. */
  requestFile: DebugBodyFile | null;
  statusCode: number;
  responseBody: string | null;
  responseFile: DebugBodyFile | null;
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
