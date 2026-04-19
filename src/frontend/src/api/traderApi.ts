import type {
  AssetData,
  BackendConnectionTest,
  Control,
  Position,
  TraderState,
} from "../types/trading";

const BASE_URL = "https://crypto-trader-ver-6-alpha.onrender.com";
const TIMEOUT_MS = 15000;
const STATUS_TIMEOUT_MS = 10000;

export const commonFetchOptions: RequestInit = {
  headers: { Accept: "application/json" },
  mode: "cors",
  credentials: "omit",
  cache: "no-store",
};

// ─── Exported types ──────────────────────────────────────────────────────────

export interface BackendTrade {
  symbol: string;
  entry: number;
  exit: number | null;
  pnl: number | null;
  /** v2 field — strategy name e.g. "breakout_momentum", "trend_follow" */
  strategy: string;
  timestamp: string;
}

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

export interface OverviewData {
  daily_pnl: number;
  equity: number;
  open_positions: number;
  total_pnl: number;
  /** Full asset state map returned by the backend (includes regime, signal, strategy, price) */
  assets?: Record<string, import("../types/trading").AssetData>;
  /** Raw last_update timestamp from the backend */
  last_update?: string;
}

export interface RiskData {
  version: string;
  total_capital: number;
  deployed_capital: number;
  available_capital: number;
  ratios: Record<string, number>;
  allocation_pct: number;
}

export interface BotStatus {
  status: string;
  version: string;
  server_time: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Create a fetch + timeout AbortController pair. Returns { signal, cancel }. */
function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(id),
  };
}

function normalizeSignal(raw: unknown): string {
  if (raw === null || raw === undefined) return "NONE";
  if (typeof raw === "string") return raw.trim() || "NONE";
  if (typeof raw === "number") {
    const map: Record<number, string> = { 0: "NONE", 1: "LONG", 2: "SHORT" };
    return map[raw] ?? String(raw);
  }
  return String(raw);
}

function normalizeScope(scope: string): string {
  const upper = scope.trim().toUpperCase();
  return upper === "GLOBAL" ? "GLOBAL" : upper;
}

/** Normalize the raw backend state into a valid TraderState object. */
function normalizeState(raw: unknown): TraderState {
  if (!raw || typeof raw !== "object") {
    console.warn("[traderApi] normalizeState received non-object:", raw);
    return {
      assets: {},
      controls: [],
      last_update: new Date().toISOString(),
    };
  }

  const state = raw as Record<string, unknown>;
  console.debug("[traderApi] raw state keys:", Object.keys(state));

  const rawAssets: Record<string, Record<string, unknown>> = {};
  if (state.assets && typeof state.assets === "object") {
    if (Array.isArray(state.assets)) {
      for (const item of state.assets as Record<string, unknown>[]) {
        if (item?.symbol && typeof item.symbol === "string") {
          rawAssets[item.symbol] = item;
        }
      }
    } else {
      const assetObj = state.assets as Record<string, unknown>;
      for (const key of Object.keys(assetObj)) {
        if (assetObj[key] && typeof assetObj[key] === "object") {
          rawAssets[key] = assetObj[key] as Record<string, unknown>;
        }
      }
    }
  }

  const assets: Record<string, AssetData> = {};
  for (const key of Object.keys(rawAssets)) {
    const r = rawAssets[key];
    assets[key] = {
      ...(r as unknown as AssetData),
      signal: normalizeSignal(r.signal),
      position:
        r.position !== undefined ? (r.position as Position | null) : null,
    };
  }

  let controls: Control[] = [];
  if (Array.isArray(state.controls)) {
    controls = (state.controls as Record<string, unknown>[])
      .filter(Boolean)
      .map((c) => ({
        scope: normalizeScope(String(c.scope ?? "")),
        enabled: Boolean(c.enabled),
        flatten_on_disable: Boolean(c.flatten_on_disable),
      }));
  }

  return {
    ...(state as unknown as TraderState),
    assets,
    controls,
    last_update:
      (state.last_update as string | number) ?? new Date().toISOString(),
    signal: normalizeSignal(state.signal),
  };
}

// ─── Existing endpoints ───────────────────────────────────────────────────────

export async function fetchState(): Promise<TraderState> {
  const { signal, cancel } = withTimeout(TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/v2/overview`, {
      ...commonFetchOptions,
      signal,
    });
    cancel();

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`fetchState ${res.status}: ${text}`);
    }

    const raw = await res.json();
    // /api/v2/overview returns { daily_pnl, equity, open_positions, total_pnl }
    // We return a minimal TraderState so callers don't break — assets/controls
    // are populated separately via fetchControls() and fetchPositions().
    const state = normalizeState(raw);
    console.debug("[traderApi] fetchState (overview) success:", raw);
    return state;
  } catch (err) {
    cancel();
    console.error("[traderApi] fetchState failed:", err);
    throw err;
  }
}

export async function fetchControls(): Promise<Control[]> {
  const { signal, cancel } = withTimeout(TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/v2/controls`, {
      ...commonFetchOptions,
      signal,
    });
    cancel();

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`fetchControls ${res.status}: ${text}`);
    }

    const raw: unknown = await res.json();
    console.debug(
      "[traderApi] fetchControls raw type:",
      Array.isArray(raw) ? "array" : typeof raw,
    );

    let controls: Control[] = [];

    if (Array.isArray(raw)) {
      controls = (raw as Record<string, unknown>[])
        .filter(Boolean)
        .map((c) => ({
          scope: normalizeScope(String(c.scope ?? "")),
          enabled: Boolean(c.enabled),
          flatten_on_disable: Boolean(c.flatten_on_disable),
        }));
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      if (Array.isArray(obj.controls)) {
        controls = (obj.controls as Record<string, unknown>[])
          .filter(Boolean)
          .map((c) => ({
            scope: normalizeScope(String(c.scope ?? "")),
            enabled: Boolean(c.enabled),
            flatten_on_disable: Boolean(c.flatten_on_disable),
          }));
      } else {
        controls = Object.entries(obj)
          .filter(([, val]) => val !== null && typeof val === "object")
          .map(([key, val]) => {
            const v = val as Record<string, unknown>;
            return {
              scope: normalizeScope(key),
              enabled: Boolean(v.enabled),
              flatten_on_disable: Boolean(v.flatten_on_disable),
            };
          });
      }
    }

    // Deduplicate by scope — GLOBAL wins over global
    const seen = new Map<string, Control>();
    for (const c of controls) {
      seen.set(c.scope, c);
    }
    const result = Array.from(seen.values());
    console.debug(
      "[traderApi] fetchControls normalized:",
      result.map((c) => c.scope),
    );
    return result;
  } catch (err) {
    cancel();
    console.error("[traderApi] fetchControls failed:", err);
    throw err;
  }
}

export async function updateControl(payload: Partial<Control>): Promise<void> {
  const { signal, cancel } = withTimeout(TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/v2/controls`, {
      ...commonFetchOptions,
      method: "POST",
      headers: {
        ...(commonFetchOptions.headers as Record<string, string>),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    });
    cancel();

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`updateControl ${res.status}: ${text}`);
    }
  } catch (err) {
    cancel();
    console.error("[traderApi] updateControl failed:", err);
    throw err;
  }
}

/** Lightweight connectivity probe — hits /health with a 5s timeout. Returns true if status 200. */
export async function probeBackend(): Promise<boolean> {
  const { signal, cancel } = withTimeout(5000);
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      ...commonFetchOptions,
      signal,
    });
    cancel();
    return res.ok;
  } catch {
    cancel();
    return false;
  }
}

/** Quick health-check to test backend connectivity on startup. */
export async function testBackendConnection(): Promise<BackendConnectionTest> {
  const start = Date.now();
  const primary = withTimeout(8000);
  const fallback = withTimeout(8000);
  try {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/health`, {
        ...commonFetchOptions,
        signal: primary.signal,
      });
      primary.cancel();
    } catch {
      primary.cancel();
      res = await fetch(`${BASE_URL}/`, {
        ...commonFetchOptions,
        signal: fallback.signal,
      });
      fallback.cancel();
    }
    const latencyMs = Date.now() - start;
    return { ok: res.ok || res.status < 500, latencyMs };
  } catch (err) {
    primary.cancel();
    fallback.cancel();
    const latencyMs = Date.now() - start;
    return {
      ok: false,
      latencyMs,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

// ─── New endpoints ────────────────────────────────────────────────────────────

/** GET /api/v2/trades — paginated closed trades. Returns { data: [], total: 0 } on error. */
export async function fetchTrades(
  page = 1,
  limit = 20,
): Promise<{ data: BackendTrade[]; total: number }> {
  const { signal, cancel } = withTimeout(TIMEOUT_MS);
  try {
    const res = await fetch(
      `${BASE_URL}/api/v2/trades?page=${page}&limit=${limit}`,
      {
        ...commonFetchOptions,
        signal,
      },
    );
    cancel();

    if (!res.ok) {
      console.warn(`[traderApi] fetchTrades HTTP ${res.status}`);
      return { data: [], total: 0 };
    }

    const raw: unknown = await res.json();

    // /api/v2/trades returns { data: [...], page, limit, total }
    let items: Record<string, unknown>[] = [];
    let total = 0;

    if (Array.isArray(raw)) {
      items = raw as Record<string, unknown>[];
      total = items.length;
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      total = typeof obj.total === "number" ? obj.total : 0;
      if (Array.isArray(obj.data)) {
        items = obj.data as Record<string, unknown>[];
      } else if (Array.isArray(obj.trades)) {
        items = obj.trades as Record<string, unknown>[];
      }
    }

    if (items.length === 0 && !Array.isArray(raw)) {
      console.warn("[traderApi] fetchTrades unexpected response shape:", raw);
    }

    const data: BackendTrade[] = items.map((t) => ({
      symbol: String(t.symbol ?? ""),
      entry: Number(t.entry ?? 0),
      exit: t.exit != null ? Number(t.exit) : null,
      pnl: t.pnl != null ? Number(t.pnl) : null,
      strategy: String(t.strategy ?? t.regime ?? ""),
      timestamp: String(t.timestamp ?? ""),
    }));

    return { data, total: total || data.length };
  } catch (err) {
    cancel();
    console.error("[traderApi] fetchTrades failed:", err);
    return { data: [], total: 0 };
  }
}

/** GET /api/v2/positions — open positions. Returns [] on error.
 *  Response shape: { results: [{ symbol, entry_price, sl, tp1, tp2, tp3, size, strategy, ... }] }
 *  We map to our BackendPosition shape (entry_price→entry, tp1→tp, etc.)
 */
export async function fetchPositions(): Promise<BackendPosition[]> {
  const { signal, cancel } = withTimeout(TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/v2/positions`, {
      ...commonFetchOptions,
      signal,
    });
    cancel();

    if (!res.ok) {
      console.warn(`[traderApi] fetchPositions HTTP ${res.status}`);
      return [];
    }

    const raw: unknown = await res.json();

    // /api/v2/positions returns { results: [...] }
    let items: Record<string, unknown>[] = [];
    if (Array.isArray(raw)) {
      items = raw as Record<string, unknown>[];
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      if (Array.isArray(obj.results)) {
        items = obj.results as Record<string, unknown>[];
      } else if (Array.isArray(obj.positions)) {
        items = obj.positions as Record<string, unknown>[];
      }
    }

    if (items.length === 0 && !Array.isArray(raw)) {
      console.warn("[traderApi] fetchPositions unexpected shape:", raw);
    }

    return items.map((p) => {
      // v2 uses entry_price; legacy used entry
      const entry = Number(p.entry_price ?? p.entry ?? 0);
      // v2 uses tp1; legacy used tp
      const tp = Number(p.tp1 ?? p.tp ?? 0);
      const tp2Raw = p.tp2 ?? null;
      const tp2 =
        tp2Raw !== null && tp2Raw !== "0.0" && Number(tp2Raw) > 0
          ? Number(tp2Raw)
          : null;
      const currentPrice = Number(p.current_price ?? p.price ?? 0);
      const pnl = Number(p.pnl ?? 0);

      return {
        symbol: String(p.symbol ?? ""),
        entry,
        sl: Number(p.sl ?? 0),
        tp,
        tp2,
        size: Number(p.size ?? 0),
        strategy: String(p.strategy ?? p.regime ?? ""),
        regime: String(p.regime ?? p.strategy ?? ""),
        confidence: Number(p.confidence ?? 0),
        current_price: currentPrice,
        pnl,
      };
    });
  } catch (err) {
    cancel();
    console.error("[traderApi] fetchPositions failed:", err);
    return [];
  }
}

/** GET /risk — RETIRED. Returns null without making a network call. */
export async function fetchRisk(): Promise<RiskData | null> {
  return null;
}

/** GET /health — bot running status and version. Returns null on error. */
export async function fetchStatus(): Promise<BotStatus | null> {
  const { signal, cancel } = withTimeout(STATUS_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      ...commonFetchOptions,
      signal,
    });
    cancel();

    if (!res.ok) {
      console.warn(`[traderApi] fetchStatus HTTP ${res.status}`);
      return null;
    }

    const raw = (await res.json()) as Record<string, unknown>;

    return {
      status: String(raw.status ?? ""),
      version: String(raw.version ?? ""),
      server_time: Number(raw.server_time ?? 0),
    };
  } catch (err) {
    cancel();
    console.error("[traderApi] fetchStatus failed:", err);
    return null;
  }
}

/** GET /caffeine/full — RETIRED. Returns null without making a network call. */
export async function fetchFullState(): Promise<{
  state: TraderState;
  positions: BackendPosition[];
} | null> {
  return null;
}

/** GET /api/v2/overview — equity summary and daily/total PnL. Returns null on error. */
export async function fetchOverview(): Promise<OverviewData | null> {
  const { signal, cancel } = withTimeout(TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/v2/overview`, {
      ...commonFetchOptions,
      signal,
    });
    cancel();

    if (!res.ok) {
      console.warn(`[traderApi] fetchOverview HTTP ${res.status}`);
      return null;
    }

    const raw = (await res.json()) as Record<string, unknown>;
    // Include the full assets map if present (used for price extraction)
    const assetsRaw = raw.assets;
    return {
      daily_pnl: Number(raw.daily_pnl ?? 0),
      equity: Number(raw.equity ?? 0),
      open_positions: Number(raw.open_positions ?? 0),
      total_pnl: Number(raw.total_pnl ?? 0),
      ...(assetsRaw && typeof assetsRaw === "object"
        ? {
            assets: assetsRaw as Record<
              string,
              import("../types/trading").AssetData
            >,
          }
        : {}),
      last_update:
        typeof raw.last_update === "string" ? raw.last_update : undefined,
    };
  } catch (err) {
    cancel();
    console.error("[traderApi] fetchOverview failed:", err);
    return null;
  }
}
