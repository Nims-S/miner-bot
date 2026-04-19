export interface Position {
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  take_profit_2?: number;
  size: number;
  direction?: "LONG" | "SHORT";
  unrealized_pnl?: number;
  unrealized_pnl_pct?: number;
  trailing_stop?: number | null;
  /** Live price from /positions endpoint */
  current_price?: number;
  /** Unrealized PnL from /positions endpoint */
  pnl?: number;
}

export interface Control {
  scope: string;
  enabled: boolean;
  flatten_on_disable?: boolean;
}

export interface AssetData {
  symbol: string;
  regime: string;
  strategy: string;
  signal: string;
  position: Position | null;
  current_price?: number;
  daily_pnl?: number;
  daily_pnl_pct?: number;
  pnl_today?: number;
  pnl_total?: number;
  price?: number;
}

export interface TraderState {
  assets: Record<string, AssetData>;
  controls: Control[];
  last_update: string | number;
  global_enabled?: boolean;
  emergency_flatten?: boolean;
  regime?: string;
  strategy?: string;
  signal?: string;
  position?: Position | null;
  balance?: number;
}

export interface BinancePrice {
  symbol: string;
  price: string;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  entry: number;
  exit: number | null;
  size: number;
  pnl: number | null;
  pnlPct: number | null;
  date: string;
  openedAt?: number;
  closedAt?: string;
  duration?: number;
  isWin?: boolean;
  status: "OPEN" | "CLOSED" | "STOPPED";
}

export type SignalType = "LONG" | "SHORT" | "NONE";
export type RegimeType = "BULL" | "BEAR" | "RANGING" | "VOLATILE" | string;

export interface ChartDataPoint {
  date: string;
  pnl: number;
  cumulative: number;
  time?: string;
  price?: number;
  volume?: number;
}

export type ConnectionStatus = "connected" | "disconnected" | "error";

/** Which price source is currently active */
export type PriceSource = "coingecko" | "coincap" | "cached" | "backend" | null;

export interface BackendConnectionTest {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

/** Trade record as returned by the /api/v2/trades endpoint */
export interface BackendTrade {
  symbol: string;
  entry: number;
  exit: number | null;
  pnl: number | null;
  /** v2 strategy field e.g. "breakout_momentum", "trend_follow", "unknown" */
  strategy: string;
  timestamp: string;
}

/** Position record as returned by the /api/v2/positions endpoint */
export interface BackendPosition {
  symbol: string;
  /** Mapped from entry_price in /api/v2/positions */
  entry: number;
  sl: number;
  /** Mapped from tp1 in /api/v2/positions */
  tp: number;
  tp2: number | null;
  size: number;
  strategy: string;
  /** Legacy alias */
  regime?: string;
  confidence: number;
  current_price: number;
  pnl: number;
}

/** Overview summary from the /api/v2/overview endpoint */
export interface OverviewData {
  daily_pnl: number;
  equity: number;
  open_positions: number;
  total_pnl: number;
  /** Full asset state map returned by the backend (includes regime, signal, strategy, price) */
  assets?: Record<string, AssetData>;
  /** Raw last_update timestamp from the backend */
  last_update?: string;
}

export type StreamStatus = "streaming" | "polling" | "disconnected";

/** Risk/capital data from the /risk endpoint */
export interface RiskData {
  version: string;
  total_capital: number;
  deployed_capital: number;
  available_capital: number;
  ratios: Record<string, number>;
  allocation_pct: number;
}

/** Bot status from the /health endpoint */
export interface BotStatus {
  status: string;
  version: string;
  server_time: number;
}
