/**
 * Real-time EventSource stream — PRIMARY live data source.
 *
 * Connects to /api/v2/stream on the backend.
 * On each message, parses the data and fires the appropriate callbacks.
 * Reconnects automatically with exponential backoff (max 30s).
 *
 * The polling loop in useAutoRefresh is the fallback when the stream is down.
 */

const BASE_URL = "https://crypto-trader-ver-6-alpha.onrender.com";
const STREAM_URL = `${BASE_URL}/api/v2/stream`;

export type StreamStatus = "connected" | "connecting" | "disconnected";

/** Stream data shape — fields present vary by message type */
export interface StreamMessage {
  assets?: Record<string, unknown>;
  positions?: unknown[];
  trades?: unknown[];
  controls?: unknown[];
  overview?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StreamCallbacks {
  /** Called with the full parsed message on every stream event */
  onMessage?: (msg: StreamMessage) => void;
  /** Called when stream connects or reconnects */
  onConnect?: () => void;
  /** Called when stream disconnects (before reconnect attempt) */
  onDisconnect?: () => void;
  /** Called with the new status on every status change */
  onStatusChange?: (status: StreamStatus) => void;
}

let currentStatus: StreamStatus = "disconnected";

export function getStreamStatus(): StreamStatus {
  return currentStatus;
}

function setStatus(s: StreamStatus, cb?: (status: StreamStatus) => void) {
  if (currentStatus !== s) {
    currentStatus = s;
    cb?.(s);
  }
}

/**
 * Open a Server-Sent Events connection to /api/v2/stream.
 *
 * Returns a cleanup function. Call it to permanently close the stream
 * (e.g. on component unmount). The cleanup cancels any pending reconnect.
 */
export function createTradeStream(callbacks: StreamCallbacks): () => void {
  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = 2000; // start at 2s, double each attempt up to 30s
  let destroyed = false;

  function connect() {
    if (destroyed) return;

    setStatus("connecting", callbacks.onStatusChange);

    try {
      es = new EventSource(STREAM_URL);
    } catch {
      // EventSource constructor can throw in some environments
      scheduleReconnect();
      return;
    }

    es.onopen = () => {
      if (destroyed) {
        es?.close();
        return;
      }
      retryDelay = 2000; // reset backoff on successful connect
      setStatus("connected", callbacks.onStatusChange);
      callbacks.onConnect?.();
    };

    es.onmessage = (e: MessageEvent) => {
      if (destroyed) return;
      try {
        const parsed = JSON.parse(e.data as string) as StreamMessage;
        callbacks.onMessage?.(parsed);
      } catch (parseErr) {
        console.warn("[streamApi] Failed to parse stream message:", parseErr);
      }
    };

    es.onerror = () => {
      if (destroyed) return;
      es?.close();
      es = null;
      setStatus("disconnected", callbacks.onStatusChange);
      callbacks.onDisconnect?.();
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (destroyed) return;
    reconnectTimer = setTimeout(() => {
      retryDelay = Math.min(retryDelay * 2, 30000);
      connect();
    }, retryDelay);
  }

  connect();

  return () => {
    destroyed = true;
    if (reconnectTimer !== null) clearTimeout(reconnectTimer);
    es?.close();
    es = null;
    setStatus("disconnected", callbacks.onStatusChange);
  };
}
