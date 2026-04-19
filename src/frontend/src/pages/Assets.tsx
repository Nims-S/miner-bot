import {
  Activity,
  BarChart2,
  CircleDot,
  Layers,
  MinusCircle,
  Radio,
  ShieldOff,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { getSymbolKey } from "../api/binanceApi";
import { updateControl } from "../api/traderApi";
import SignalBadge from "../components/ui/SignalBadge";
import StatusBadge from "../components/ui/StatusBadge";
import { useTradingStore } from "../store/tradingStore";
import type {
  AssetData,
  BackendPosition,
  BackendTrade,
  Control,
  TradeRecord,
} from "../types/trading";

// ─── Constants ───────────────────────────────────────────────────────────────

const SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT"] as const;
type SymbolKey = (typeof SYMBOLS)[number];

const TICKER_META: Record<string, { color: string; icon: string }> = {
  BTC: { color: "#f7931a", icon: "₿" },
  ETH: { color: "#627eea", icon: "Ξ" },
  SOL: { color: "#9945ff", icon: "◎" },
};

const REGIME_DESC: Record<string, string> = {
  TREND: "Trending — momentum strategy active",
  TRENDING: "Trending — momentum strategy active",
  RANGE: "Range-bound — mean reversion active",
  RANGING: "Range-bound — mean reversion active",
  UNKNOWN: "Regime unclear — reduced sizing",
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, digits = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function getTicker(symbol: string) {
  return symbol.replace("/USDT", "").replace("USDT", "").replace("-USDT", "");
}

function getAssetStatus(asset: AssetData, controls: Control[]) {
  const scope = asset.symbol ?? "";
  const ctrl = (Array.isArray(controls) ? controls : []).find(
    (c) => c.scope === scope || c.scope === getTicker(scope),
  );
  if (!ctrl?.enabled) return "PAUSED";
  if (asset.position) return "IN TRADE";
  return "ACTIVE";
}

/**
 * Build a 14-day daily PnL dataset.
 * Source: BackendTrade[] from /trades (preferred) merged with TradeRecord[] from persisted history.
 * Safe date parsing — never throws.
 */
function buildDailyPnlChart(
  backendTrades: BackendTrade[],
  localTrades: TradeRecord[],
  symbol: string,
): { label: string; dateKey: string; pnl: number }[] {
  const now = new Date();
  const days: { label: string; dateKey: string; pnl: number }[] = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const mm = MONTHS[d.getMonth()];
    const dd = d.getDate();
    const label = `${mm} ${dd}`;
    const dateKey = d.toISOString().slice(0, 10);
    days.push({ label, dateKey, pnl: 0 });
  }

  // Aggregate backend trades (primary source)
  for (const t of backendTrades) {
    if (t.pnl === null || t.pnl === undefined) continue;
    if (t.symbol !== symbol) continue;
    let dateStr = "";
    try {
      dateStr = new Date(t.timestamp).toISOString().slice(0, 10);
    } catch {
      continue;
    }
    const day = days.find((d) => d.dateKey === dateStr);
    if (day) day.pnl = Math.round((day.pnl + t.pnl) * 100) / 100;
  }

  // Supplement with local trade history (only add if not already counted by backend)
  // Use a separate pass to avoid double-counting: only add local trades if no backend data for that day
  const backendDays = new Set<string>();
  for (const t of backendTrades) {
    if (t.symbol !== symbol || t.pnl === null) continue;
    try {
      backendDays.add(new Date(t.timestamp).toISOString().slice(0, 10));
    } catch {
      // skip
    }
  }

  for (const t of localTrades) {
    if (t.pnl === null || t.pnl === undefined) continue;
    if (t.symbol !== symbol) continue;
    let dateStr = "";
    try {
      const raw = t.closedAt ?? t.date;
      if (!raw) continue;
      dateStr = new Date(raw).toISOString().slice(0, 10);
    } catch {
      continue;
    }
    if (backendDays.has(dateStr)) continue; // backend already has data for this day
    const day = days.find((d) => d.dateKey === dateStr);
    if (day) day.pnl = Math.round((day.pnl + (t.pnl ?? 0)) * 100) / 100;
  }

  return days;
}

/**
 * Merge backendTrades + localTrades for a symbol into unified stats.
 * BackendTrade is the primary source; local trades supplement if no overlap.
 */
function calcStats(backendTrades: BackendTrade[], localTrades: TradeRecord[]) {
  // Convert BackendTrade → lightweight record for unified processing
  type Row = { pnl: number; isWin: boolean };
  const rows: Row[] = [];

  const usedTimestamps = new Set<string>();

  for (const t of backendTrades) {
    if (t.pnl === null || t.pnl === undefined) continue;
    rows.push({ pnl: t.pnl, isWin: t.pnl > 0 });
    usedTimestamps.add(t.timestamp);
  }

  // Add local trades that have no overlapping backend timestamp
  for (const t of localTrades) {
    if (t.pnl === null || t.pnl === undefined) continue;
    // Avoid double-counting: skip if a backend trade exists at same closedAt
    if (t.closedAt && usedTimestamps.has(t.closedAt)) continue;
    rows.push({ pnl: t.pnl, isWin: t.isWin ?? t.pnl > 0 });
  }

  if (!rows.length) return null;

  const wins = rows.filter((r) => r.isWin);
  const losses = rows.filter((r) => !r.isWin && r.pnl < 0);
  const totalPnl = rows.reduce((s, r) => s + r.pnl, 0);
  const winSum = wins.reduce((s, r) => s + r.pnl, 0);
  const lossSum = losses.reduce((s, r) => s + r.pnl, 0);
  const profitFactor =
    lossSum !== 0 ? winSum / Math.abs(lossSum) : winSum > 0 ? 999 : 0;

  return {
    total: rows.length,
    winRate: (wins.length / rows.length) * 100,
    totalPnl,
    avgWin: wins.length ? winSum / wins.length : null,
    avgLoss: losses.length ? lossSum / losses.length : null,
    largestWin: wins.length ? Math.max(...wins.map((r) => r.pnl)) : null,
    largestLoss: losses.length ? Math.min(...losses.map((r) => r.pnl)) : null,
    profitFactor,
  };
}

// ─── Position Visualization Bar ───────────────────────────────────────────────

function PositionBar({
  entry,
  sl,
  tp1,
  tp2,
  currentPrice,
}: {
  entry: number;
  sl: number;
  tp1: number;
  tp2?: number | null;
  currentPrice: number | null;
}) {
  const cp = currentPrice ?? entry;
  const hasTP2 = tp2 != null;
  const allValues = [sl, entry, tp1, ...(hasTP2 ? [tp2] : []), cp];
  const min = Math.min(...allValues) * 0.998;
  const max = Math.max(...allValues) * 1.002;
  const range = max - min || 1;
  const pct = (v: number) => `${(((v - min) / range) * 100).toFixed(2)}%`;

  const entryPct = ((entry - min) / range) * 100;
  const tp1Pct = ((tp1 - min) / range) * 100;
  const isProfit = cp >= entry;

  return (
    <div className="space-y-2">
      <div
        className="relative h-6 rounded-lg overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Red zone: SL → Entry */}
        <div
          className="absolute inset-y-0"
          style={{
            left: pct(sl),
            width: `${(((entry - sl) / range) * 100).toFixed(2)}%`,
            background:
              "linear-gradient(90deg, rgba(255,68,68,0.15) 0%, rgba(255,68,68,0.05) 100%)",
          }}
        />
        {/* Green zone: Entry → TP2 (or TP1 when TP2 absent) */}
        <div
          className="absolute inset-y-0"
          style={{
            left: pct(entry),
            right: `${(100 - (((hasTP2 ? tp2! : tp1) - min) / range) * 100).toFixed(2)}%`,
            background:
              "linear-gradient(90deg, rgba(57,255,20,0.05) 0%, rgba(57,255,20,0.2) 100%)",
          }}
        />
        {/* SL marker */}
        <div
          className="absolute inset-y-0 w-[2px]"
          style={{ left: pct(sl), background: "#ff4444" }}
        />
        {/* Entry marker */}
        <div
          className="absolute inset-y-0 w-[2px]"
          style={{ left: pct(entry), background: "rgba(226,232,240,0.5)" }}
        />
        {/* TP1 marker */}
        <div
          className="absolute inset-y-0 w-[2px]"
          style={{ left: pct(tp1), background: "rgba(57,255,20,0.6)" }}
        />
        {/* TP2 marker — only when backend provides it */}
        {hasTP2 && (
          <div
            className="absolute inset-y-0 w-[2px]"
            style={{ left: pct(tp2!), background: "#39ff14" }}
          />
        )}
        {/* Current price dot */}
        {currentPrice !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 z-10 transition-smooth"
            style={{
              left: `calc(${pct(currentPrice)} - 6px)`,
              background: isProfit ? "#39ff14" : "#ff4444",
              borderColor: "#0b0f14",
              boxShadow: `0 0 8px ${isProfit ? "#39ff14" : "#ff4444"}`,
            }}
          />
        )}
        {/* Entry label */}
        <div
          className="absolute inset-y-0 flex items-center"
          style={{ left: `calc(${entryPct.toFixed(2)}% + 4px)` }}
        >
          <span className="text-[9px] font-mono text-[rgba(226,232,240,0.5)] truncate">
            Entry
          </span>
        </div>
        {/* TP1 label */}
        <div
          className="absolute inset-y-0 flex items-center"
          style={{ left: `calc(${tp1Pct.toFixed(2)}% + 4px)` }}
        >
          <span className="text-[9px] font-mono text-[rgba(57,255,20,0.7)] truncate">
            TP1
          </span>
        </div>
      </div>
      {/* Price labels below bar */}
      <div className="flex justify-between text-[10px] font-mono px-1">
        <span className="text-[#ff4444]">SL ${fmt(sl)}</span>
        <span className="text-[rgba(226,232,240,0.6)]">
          Entry ${fmt(entry)}
        </span>
        <span className="text-[rgba(57,255,20,0.8)]">TP1 ${fmt(tp1)}</span>
        {hasTP2 && <span className="text-[#39ff14]">TP2 ${fmt(tp2!)}</span>}
      </div>
    </div>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

function StatsCard({
  backendTrades,
  localTrades,
}: {
  backendTrades: BackendTrade[];
  localTrades: TradeRecord[];
}) {
  const stats = calcStats(backendTrades, localTrades);
  const dash = "—";

  const Row = ({
    label,
    value,
    color,
  }: { label: string; value: string; color?: string }) => (
    <div className="flex items-center justify-between py-1 border-b border-[rgba(255,255,255,0.04)] last:border-0">
      <span className="text-[11px] text-[rgba(226,232,240,0.45)]">{label}</span>
      <span
        className="text-[11px] font-mono font-semibold"
        style={{ color: color ?? "#e2e8f0" }}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="glass-card p-4 space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 size={13} className="text-[#00d9ff]" />
        <p className="text-[10px] uppercase tracking-wider text-[rgba(226,232,240,0.45)] font-semibold">
          Performance
        </p>
        {stats && (
          <span className="ml-auto text-[9px] text-[rgba(226,232,240,0.3)] font-mono">
            {stats.total} trades
          </span>
        )}
      </div>
      <Row label="Total Trades" value={stats ? String(stats.total) : dash} />
      <Row
        label="Win Rate"
        value={stats ? `${stats.winRate.toFixed(1)}%` : dash}
        color={
          stats ? (stats.winRate >= 50 ? "#39ff14" : "#ff4444") : undefined
        }
      />
      <Row
        label="Total PnL"
        value={
          stats
            ? `${stats.totalPnl >= 0 ? "+" : "-"}$${fmt(Math.abs(stats.totalPnl))}`
            : dash
        }
        color={
          stats ? (stats.totalPnl >= 0 ? "#39ff14" : "#ff4444") : undefined
        }
      />
      <Row
        label="Avg Win"
        value={stats?.avgWin != null ? `+$${fmt(stats.avgWin)}` : dash}
        color="#39ff14"
      />
      <Row
        label="Avg Loss"
        value={
          stats?.avgLoss != null ? `-$${fmt(Math.abs(stats.avgLoss))}` : dash
        }
        color="#ff4444"
      />
      <Row
        label="Best Trade"
        value={stats?.largestWin != null ? `+$${fmt(stats.largestWin)}` : dash}
        color="#39ff14"
      />
      <Row
        label="Worst Trade"
        value={
          stats?.largestLoss != null
            ? `-$${fmt(Math.abs(stats.largestLoss))}`
            : dash
        }
        color="#ff4444"
      />
      <Row
        label="Profit Factor"
        value={stats ? fmt(stats.profitFactor) : dash}
        color={
          stats
            ? stats.profitFactor >= 1.5
              ? "#39ff14"
              : stats.profitFactor >= 1
                ? "#00d9ff"
                : "#ff4444"
            : undefined
        }
      />
    </div>
  );
}

// ─── PnL Chart ────────────────────────────────────────────────────────────────

function PnlChart({
  backendTrades,
  localTrades,
  symbol,
}: {
  backendTrades: BackendTrade[];
  localTrades: TradeRecord[];
  symbol: string;
}) {
  const data = buildDailyPnlChart(backendTrades, localTrades, symbol);
  const hasData = data.some((d) => d.pnl !== 0);

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={13} className="text-[#00d9ff]" />
        <p className="text-[10px] uppercase tracking-wider text-[rgba(226,232,240,0.45)] font-semibold">
          14-Day PnL
        </p>
        {hasData && (
          <span className="ml-auto text-[9px] text-[rgba(226,232,240,0.3)] font-mono">
            live data
          </span>
        )}
      </div>
      {!hasData ? (
        <div className="h-[120px] flex items-center justify-center">
          <p className="text-[11px] text-[rgba(226,232,240,0.3)]">
            No closed trades in range
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(226,232,240,0.35)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval={1}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "rgba(11,15,20,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 11,
                fontFamily: "JetBrains Mono, monospace",
                color: "#e2e8f0",
              }}
              formatter={(value: number) => [
                `${value >= 0 ? "+" : "-"}$${fmt(Math.abs(value))}`,
                "PnL",
              ]}
            />
            <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`${entry.dateKey}-${index}`}
                  fill={
                    entry.pnl >= 0
                      ? "rgba(57,255,20,0.75)"
                      : "rgba(255,68,68,0.75)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Controls Section ─────────────────────────────────────────────────────────

function AssetControls({
  symbol,
  controls,
}: {
  symbol: string;
  controls: Control[];
}) {
  const { updateControlOptimistic, rollbackControl } = useTradingStore();
  const [inFlight, setInFlight] = useState(false);
  const ticker = getTicker(symbol);
  const ctrl = (Array.isArray(controls) ? controls : []).find(
    (c) => c.scope === symbol || c.scope === ticker,
  );

  const handleToggle = async (field: "enabled" | "flatten_on_disable") => {
    if (!ctrl || inFlight) return;
    const prev = { ...ctrl };
    const nextEnabled = field === "enabled" ? !ctrl.enabled : ctrl.enabled;
    const nextFlatten =
      field === "flatten_on_disable"
        ? !ctrl.flatten_on_disable
        : ctrl.flatten_on_disable;
    updateControlOptimistic(ctrl.scope, nextEnabled, nextFlatten);
    setInFlight(true);
    try {
      await updateControl({
        scope: ctrl.scope,
        enabled: nextEnabled,
        flatten_on_disable: nextFlatten,
      });
      toast.success(
        `${ticker} ${field === "enabled" ? (nextEnabled ? "enabled" : "disabled") : "flatten updated"}`,
      );
    } catch {
      rollbackControl(ctrl.scope, prev);
      toast.error("Failed to update control");
    } finally {
      setInFlight(false);
    }
  };

  if (!ctrl) return null;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldOff size={13} className="text-[rgba(226,232,240,0.4)]" />
        <p className="text-[10px] uppercase tracking-wider text-[rgba(226,232,240,0.45)] font-semibold">
          Controls
        </p>
        {inFlight && (
          <span
            data-ocid={`assets.${ticker.toLowerCase()}.controls.loading_state`}
            className="ml-auto w-3 h-3 rounded-full border border-t-transparent border-[#00d9ff] animate-spin"
          />
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[11px] text-[rgba(226,232,240,0.6)]">
            Enable Trading
          </span>
          <button
            data-ocid={`assets.${ticker.toLowerCase()}.enable_toggle`}
            type="button"
            disabled={inFlight}
            onClick={() => handleToggle("enabled")}
            className={`relative w-9 h-5 rounded-full transition-smooth disabled:opacity-40 ${
              ctrl.enabled
                ? "bg-[rgba(57,255,20,0.3)] border border-[rgba(57,255,20,0.4)]"
                : "bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)]"
            }`}
            aria-label={`Toggle ${ticker} trading`}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full transition-smooth"
              style={{
                left: ctrl.enabled ? "calc(100% - 18px)" : "2px",
                background: ctrl.enabled ? "#39ff14" : "rgba(226,232,240,0.3)",
                boxShadow: ctrl.enabled ? "0 0 6px #39ff14" : "none",
              }}
            />
          </button>
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[11px] text-[rgba(226,232,240,0.6)]">
            Flatten on Disable
          </span>
          <button
            data-ocid={`assets.${ticker.toLowerCase()}.flatten_toggle`}
            type="button"
            disabled={inFlight}
            onClick={() => handleToggle("flatten_on_disable")}
            className={`relative w-9 h-5 rounded-full transition-smooth disabled:opacity-40 ${
              ctrl.flatten_on_disable
                ? "bg-[rgba(255,68,68,0.2)] border border-[rgba(255,68,68,0.4)]"
                : "bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)]"
            }`}
            aria-label={`Toggle ${ticker} flatten on disable`}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full transition-smooth"
              style={{
                left: ctrl.flatten_on_disable ? "calc(100% - 18px)" : "2px",
                background: ctrl.flatten_on_disable
                  ? "#ff4444"
                  : "rgba(226,232,240,0.3)",
                boxShadow: ctrl.flatten_on_disable ? "0 0 6px #ff4444" : "none",
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Strategy Info Card ────────────────────────────────────────────────────────

function StrategyCard({
  asset,
  recentBackendTrades,
}: {
  asset: AssetData;
  recentBackendTrades: BackendTrade[];
}) {
  const regime = (asset.regime ?? "UNKNOWN").toUpperCase();
  const regimeDesc = REGIME_DESC[regime] ?? "Regime unclear — reduced sizing";
  const regimeColor =
    regime === "TREND" || regime === "TRENDING"
      ? "#00d9ff"
      : regime === "RANGE" || regime === "RANGING"
        ? "#f7c35c"
        : "rgba(226,232,240,0.4)";

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CircleDot size={13} className="text-[#00d9ff]" />
        <p className="text-[10px] uppercase tracking-wider text-[rgba(226,232,240,0.45)] font-semibold">
          Strategy Info
        </p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[rgba(226,232,240,0.45)]">
          Strategy
        </span>
        <span className="text-[11px] font-semibold text-[#e2e8f0] truncate max-w-[140px]">
          {asset.strategy || "—"}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[rgba(226,232,240,0.45)]">
            Regime
          </span>
          <span
            className="text-[11px] font-bold font-mono"
            style={{ color: regimeColor }}
          >
            {regime}
          </span>
        </div>
        <p className="text-[10px] text-[rgba(226,232,240,0.35)] italic">
          {regimeDesc}
        </p>
      </div>
      {recentBackendTrades.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-[rgba(255,255,255,0.05)]">
          <p className="text-[10px] uppercase tracking-wider text-[rgba(226,232,240,0.35)] mb-1.5">
            Recent Closed Trades
          </p>
          {recentBackendTrades.slice(0, 5).map((t, i) => {
            let dateLabel = "—";
            try {
              dateLabel = new Date(t.timestamp).toISOString().slice(0, 10);
            } catch {
              // keep dash
            }
            const pnlColor =
              t.pnl === null
                ? "rgba(226,232,240,0.4)"
                : t.pnl >= 0
                  ? "#39ff14"
                  : "#ff4444";
            return (
              <div
                key={`${t.timestamp}-${i}`}
                className="flex items-center justify-between text-[10px]"
              >
                <span className="text-[rgba(226,232,240,0.4)] font-mono">
                  {dateLabel}
                </span>
                <span
                  className="font-mono font-semibold"
                  style={{ color: pnlColor }}
                >
                  {t.pnl !== null
                    ? `${t.pnl >= 0 ? "+" : "-"}$${fmt(Math.abs(t.pnl))}`
                    : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Full Asset Panel ──────────────────────────────────────────────────────────

function AssetPanel({
  symbol,
  asset,
  livePrice,
  backendPosition,
  backendTrades,
  localTrades,
  controls,
  allocationPct,
}: {
  symbol: string;
  asset: AssetData;
  livePrice: number | null;
  backendPosition: BackendPosition | null;
  backendTrades: BackendTrade[];
  localTrades: TradeRecord[];
  controls: Control[];
  allocationPct: number | null;
}) {
  const ticker = getTicker(symbol);
  const meta = TICKER_META[ticker] ?? { color: "#00d9ff", icon: "?" };
  const status = getAssetStatus(asset, controls);

  // Prefer backendPosition (has server-side current_price + pnl), fallback to state position
  const posEntry = backendPosition
    ? {
        entry_price: backendPosition.entry,
        stop_loss: backendPosition.sl,
        take_profit: backendPosition.tp,
        take_profit_2: undefined as number | undefined,
        size: backendPosition.size,
        direction: undefined as "LONG" | "SHORT" | undefined,
        confidence: backendPosition.confidence,
        server_pnl: backendPosition.pnl,
        server_current_price: backendPosition.current_price,
      }
    : asset.position
      ? {
          entry_price: asset.position.entry_price,
          stop_loss: asset.position.stop_loss,
          take_profit: asset.position.take_profit,
          take_profit_2: asset.position.take_profit_2,
          size: asset.position.size,
          direction: asset.position.direction,
          confidence: undefined as number | undefined,
          server_pnl: asset.position.pnl,
          server_current_price: asset.position.current_price,
        }
      : null;

  const hasPos = posEntry !== null && posEntry.entry_price > 0;

  // Current price: live Binance → backend position current_price → asset price
  const currentPrice =
    livePrice ??
    (backendPosition?.current_price && backendPosition.current_price > 0
      ? backendPosition.current_price
      : null) ??
    (asset.position?.current_price && asset.position.current_price > 0
      ? asset.position.current_price
      : null);

  // PnL: prefer server-side value; compute locally as fallback
  let unrealizedPnl: number | null = null;
  let unrealizedPnlPct: number | null = null;

  if (hasPos && posEntry !== null) {
    if (posEntry.server_pnl !== undefined && posEntry.server_pnl !== null) {
      unrealizedPnl = posEntry.server_pnl;
    } else if (currentPrice !== null) {
      const dir = posEntry.direction === "SHORT" ? -1 : 1;
      unrealizedPnl =
        dir * (currentPrice - posEntry.entry_price) * posEntry.size;
    }
    if (unrealizedPnl !== null && posEntry.entry_price > 0) {
      const dir = posEntry.direction === "SHORT" ? -1 : 1;
      unrealizedPnlPct =
        currentPrice !== null
          ? ((dir * (currentPrice - posEntry.entry_price)) /
              posEntry.entry_price) *
            100
          : null;
    }
  }

  // R/R ratio
  const rr =
    hasPos &&
    posEntry !== null &&
    posEntry.stop_loss > 0 &&
    posEntry.take_profit > 0 &&
    posEntry.entry_price !== posEntry.stop_loss
      ? Math.abs(posEntry.take_profit - posEntry.entry_price) /
        Math.abs(posEntry.entry_price - posEntry.stop_loss)
      : null;

  const regime = (asset.regime ?? "UNKNOWN").toUpperCase();
  const regimeColor =
    regime === "TREND" || regime === "TRENDING"
      ? "#00d9ff"
      : regime === "RANGE" || regime === "RANGING"
        ? "#f7c35c"
        : "rgba(226,232,240,0.4)";

  return (
    <div
      data-ocid={`assets.${ticker.toLowerCase()}.panel`}
      className="space-y-3"
    >
      {/* Header Card */}
      <div className="glass-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Coin icon */}
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
              style={{
                background: `${meta.color}15`,
                color: meta.color,
                border: `1.5px solid ${meta.color}35`,
              }}
            >
              {meta.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-[#e2e8f0]">
                  {ticker}
                </span>
                <span className="text-sm text-[rgba(226,232,240,0.35)]">
                  /USDT
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {/* Regime badge */}
                <span
                  className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded"
                  style={{
                    color: regimeColor,
                    background: `${regimeColor}15`,
                    border: `1px solid ${regimeColor}30`,
                  }}
                >
                  {regime}
                </span>
                <SignalBadge signal={asset.signal} size="sm" />
                <StatusBadge status={status} size="sm" />
              </div>
            </div>
          </div>

          {/* Right: price + allocation */}
          <div className="text-right flex-shrink-0">
            {currentPrice !== null && currentPrice > 0 ? (
              <>
                <p className="text-xl font-bold font-mono text-[#00d9ff]">
                  ${fmt(currentPrice)}
                </p>
                {hasPos && unrealizedPnl !== null && (
                  <p
                    className={`text-xs font-mono mt-0.5 ${unrealizedPnl >= 0 ? "text-[#39ff14]" : "text-[#ff4444]"}`}
                  >
                    {unrealizedPnl >= 0 ? "+" : "-"}$
                    {fmt(Math.abs(unrealizedPnl))}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[#00d9ff] font-mono text-sm opacity-40">--</p>
            )}
            {allocationPct !== null && allocationPct > 0 && (
              <p className="text-[10px] font-mono mt-1 text-[rgba(226,232,240,0.4)]">
                {allocationPct.toFixed(1)}% alloc
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Position Section */}
      {hasPos && posEntry !== null ? (
        <div className="glass-card-blue p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-[rgba(0,217,255,0.6)] font-semibold mb-1">
            Current Position
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: "Entry",
                value: `$${fmt(posEntry.entry_price)}`,
                color: "#e2e8f0",
              },
              {
                label: "Stop Loss",
                value: `$${fmt(posEntry.stop_loss)}`,
                color: "#ff4444",
              },
              {
                label: "TP1",
                value: `$${fmt(posEntry.take_profit)}`,
                color: "#39ff14",
              },
              {
                label: "TP2",
                value: posEntry.take_profit_2
                  ? `$${fmt(posEntry.take_profit_2)}`
                  : "—",
                color: posEntry.take_profit_2
                  ? "#39ff14"
                  : "rgba(226,232,240,0.3)",
              },
              {
                label: "Size",
                value: fmt(posEntry.size, 4),
                color: "#e2e8f0",
              },
              {
                label: "Live Price",
                value:
                  currentPrice !== null && currentPrice > 0
                    ? `$${fmt(currentPrice)}`
                    : "--",
                color: "#00d9ff",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="glassmorphic px-2 py-1.5">
                <p className="text-[9px] text-[rgba(226,232,240,0.4)] uppercase tracking-wider">
                  {label}
                </p>
                <p
                  className="text-[11px] font-mono font-semibold mt-0.5 truncate"
                  style={{ color }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Confidence row */}
          {posEntry.confidence !== undefined && (
            <div className="flex items-center justify-between py-1 border-t border-[rgba(0,217,255,0.08)]">
              <span className="text-[11px] text-[rgba(226,232,240,0.5)]">
                Confidence
              </span>
              <span className="text-[11px] font-mono font-semibold text-[#f7c35c]">
                {(posEntry.confidence * 100).toFixed(1)}%
              </span>
            </div>
          )}

          {/* Unrealized PnL */}
          {unrealizedPnl !== null && (
            <div className="flex items-center justify-between py-2 border-t border-[rgba(0,217,255,0.1)]">
              <span className="text-[11px] text-[rgba(226,232,240,0.5)]">
                Unrealized PnL
              </span>
              <span
                className={`text-[13px] font-mono font-bold ${unrealizedPnl >= 0 ? "text-[#39ff14]" : "text-[#ff4444]"}`}
              >
                {unrealizedPnl >= 0 ? "+" : "-"}${fmt(Math.abs(unrealizedPnl))}
                {unrealizedPnlPct !== null && (
                  <span className="text-[10px] ml-1 opacity-80">
                    ({unrealizedPnlPct >= 0 ? "+" : ""}
                    {unrealizedPnlPct.toFixed(2)}%)
                  </span>
                )}
              </span>
            </div>
          )}

          {/* R/R */}
          {rr !== null && (
            <div className="flex items-center justify-between py-1 border-t border-[rgba(0,217,255,0.08)]">
              <span className="text-[11px] text-[rgba(226,232,240,0.5)]">
                Risk / Reward
              </span>
              <span className="text-[11px] font-mono font-semibold text-[#00d9ff]">
                1:{rr.toFixed(2)}
              </span>
            </div>
          )}

          {/* Position Bar */}
          <div className="pt-1">
            <PositionBar
              entry={posEntry.entry_price}
              sl={posEntry.stop_loss}
              tp1={posEntry.take_profit}
              tp2={posEntry.take_profit_2 ?? undefined}
              currentPrice={currentPrice}
            />
          </div>
        </div>
      ) : (
        <div className="glass-card p-4 flex items-center gap-3">
          <MinusCircle
            size={18}
            className="text-[rgba(226,232,240,0.2)] flex-shrink-0"
          />
          <p className="text-sm text-[rgba(226,232,240,0.35)]">
            No active position
          </p>
        </div>
      )}

      {/* Stats + Chart */}
      <div className="grid grid-cols-1 gap-3">
        <StatsCard backendTrades={backendTrades} localTrades={localTrades} />
        <PnlChart
          backendTrades={backendTrades}
          localTrades={localTrades}
          symbol={symbol}
        />
      </div>

      {/* Strategy + Controls */}
      <div className="grid grid-cols-1 gap-3">
        <StrategyCard asset={asset} recentBackendTrades={backendTrades} />
        <AssetControls symbol={symbol} controls={controls} />
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Assets() {
  const {
    traderState,
    controls,
    binancePrices,
    tradeHistory,
    backendTrades,
    backendPositions,
    overviewData,
    streamStatus,
  } = useTradingStore();

  const [activeTab, setActiveTab] = useState<SymbolKey>("BTC/USDT");

  // Merge asset state from all available sources (priority: overviewData.assets > traderState.assets)
  const assets = useMemo(() => {
    const base: Record<string, AssetData> = {};
    // Start with traderState (may be null if never loaded)
    if (traderState?.assets) {
      Object.assign(base, traderState.assets);
    }
    // Overlay with overviewData.assets which is more recently updated
    if (overviewData?.assets) {
      for (const [sym, assetRaw] of Object.entries(overviewData.assets)) {
        const existing = base[sym];
        base[sym] = existing
          ? { ...existing, ...(assetRaw as AssetData) }
          : (assetRaw as AssetData);
      }
    }
    return base;
  }, [traderState, overviewData]);

  // Multi-key price lookup: slash form → raw Binance → short ticker
  const priceLookup = (symbol: string): number | null => {
    const ticker = getTicker(symbol);
    const price =
      binancePrices[symbol] ??
      binancePrices[`${ticker}USDT`] ??
      binancePrices[ticker] ??
      binancePrices[getSymbolKey(symbol)] ??
      null;
    // Never return 0 — treat as unavailable
    return price && price > 0 ? price : null;
  };

  // Pre-index backend data by symbol for O(1) lookups
  const backendPositionBySymbol = useMemo(() => {
    const map: Record<string, BackendPosition> = {};
    for (const p of backendPositions) {
      if (p.symbol) map[p.symbol] = p;
    }
    return map;
  }, [backendPositions]);

  const backendTradesBySymbol = useMemo(() => {
    const map: Record<string, BackendTrade[]> = {};
    for (const s of SYMBOLS) map[s] = [];
    for (const t of backendTrades) {
      if (map[t.symbol]) map[t.symbol].push(t);
      else {
        for (const s of SYMBOLS) {
          if (getTicker(s) === getTicker(t.symbol)) {
            map[s].push(t);
            break;
          }
        }
      }
    }
    return map;
  }, [backendTrades]);

  const localTradesBySymbol = useMemo(() => {
    const map: Record<string, TradeRecord[]> = {};
    for (const s of SYMBOLS) map[s] = [];
    for (const t of tradeHistory) {
      for (const s of SYMBOLS) {
        if (
          t.symbol === s ||
          t.symbol === getTicker(s) ||
          getTicker(t.symbol) === getTicker(s)
        ) {
          map[s].push(t);
          break;
        }
      }
    }
    return map;
  }, [tradeHistory]);

  const allocationBySymbol = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const s of SYMBOLS) map[s] = null;
    return map;
  }, []);

  // Always build asset entries for all tracked symbols — even if bot is FLAT.
  // When overviewData has no asset entry for a symbol, use a sensible default
  // so the card still renders with whatever price we have cached.
  const assetEntries: [string, AssetData][] = SYMBOLS.map((sym) => {
    const ticker = getTicker(sym);
    const asset: AssetData = assets[sym] ??
      assets[ticker] ?? {
        symbol: sym,
        regime: "UNKNOWN",
        strategy: "—",
        signal: "FLAT",
        position: null,
      };
    // Always stamp the symbol so AssetPanel can reference it
    if (!asset.symbol) asset.symbol = sym;
    return [sym, asset];
  });

  const openCount =
    backendPositions.length ||
    assetEntries.filter(([, a]) => a.position).length;

  // Stream indicator: green when SSE connected, amber when polling-only
  const streamLabel =
    streamStatus === "streaming"
      ? "Live"
      : streamStatus === "polling"
        ? "Polling"
        : "—";
  const streamColor =
    streamStatus === "streaming"
      ? "#39ff14"
      : streamStatus === "polling"
        ? "#f7c35c"
        : "rgba(226,232,240,0.3)";

  return (
    <div className="p-4 lg:p-6 space-y-4 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center gap-2">
        <Layers size={17} className="text-[#00d9ff]" />
        <h1 className="text-lg font-bold text-[#e2e8f0]">Assets</h1>
        <div className="ml-auto flex items-center gap-3 text-xs text-[rgba(226,232,240,0.35)] font-mono">
          {/* Stream status badge */}
          <span
            data-ocid="assets.stream_status"
            className="flex items-center gap-1.5"
            style={{ color: streamColor }}
          >
            <Radio size={10} />
            {streamLabel}
          </span>
          <span className={openCount > 0 ? "text-[#39ff14]" : ""}>
            {openCount} open
          </span>
          <span>{assetEntries.length} tracked</span>
        </div>
      </div>

      {/* Desktop: 3-column grid */}
      <div className="hidden md:grid md:grid-cols-3 gap-4">
        {assetEntries.map(([symbol, asset]) => (
          <AssetPanel
            key={symbol}
            symbol={symbol}
            asset={asset}
            livePrice={priceLookup(symbol)}
            backendPosition={backendPositionBySymbol[symbol] ?? null}
            backendTrades={backendTradesBySymbol[symbol] ?? []}
            localTrades={localTradesBySymbol[symbol] ?? []}
            controls={controls}
            allocationPct={allocationBySymbol[symbol]}
          />
        ))}
      </div>

      {/* Mobile: tab bar + single panel */}
      <div className="md:hidden space-y-3">
        <div data-ocid="assets.tab_bar" className="glass-card flex p-1 gap-1">
          {assetEntries.map(([symbol]) => {
            const ticker = getTicker(symbol);
            const meta = TICKER_META[ticker] ?? { color: "#00d9ff", icon: "?" };
            const isActive = activeTab === symbol;
            const lp = priceLookup(symbol);
            return (
              <button
                key={symbol}
                type="button"
                data-ocid={`assets.${ticker.toLowerCase()}.tab`}
                onClick={() => setActiveTab(symbol as SymbolKey)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-lg text-[11px] font-bold transition-smooth ${
                  isActive
                    ? "bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.12)]"
                    : "hover:bg-[rgba(255,255,255,0.04)]"
                }`}
                style={{
                  color: isActive ? meta.color : "rgba(226,232,240,0.45)",
                }}
              >
                <span className="text-base leading-none">{meta.icon}</span>
                <span>{ticker}</span>
                {lp !== null && lp > 0 && (
                  <span
                    className="text-[8px] font-mono opacity-70 tabular-nums"
                    style={{
                      color: isActive ? meta.color : "rgba(226,232,240,0.3)",
                    }}
                  >
                    ${lp < 1 ? lp.toFixed(4) : fmt(lp, lp < 100 ? 2 : 0)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active panel */}
        {assetEntries
          .filter(([symbol]) => symbol === activeTab)
          .map(([symbol, asset]) => (
            <AssetPanel
              key={symbol}
              symbol={symbol}
              asset={asset}
              livePrice={priceLookup(symbol)}
              backendPosition={backendPositionBySymbol[symbol] ?? null}
              backendTrades={backendTradesBySymbol[symbol] ?? []}
              localTrades={localTradesBySymbol[symbol] ?? []}
              controls={controls}
              allocationPct={allocationBySymbol[symbol]}
            />
          ))}
      </div>

      {/* Loading state — only when we have NO data yet at all */}
      {!traderState && !overviewData && (
        <div
          data-ocid="assets.empty_state"
          className="glass-card p-10 text-center"
        >
          <Layers
            size={36}
            className="text-[rgba(226,232,240,0.1)] mx-auto mb-3"
          />
          <p className="text-sm text-[rgba(226,232,240,0.4)]">
            Connecting to bot…
          </p>
          <p className="text-xs text-[rgba(226,232,240,0.25)] mt-1">
            Fetching live state
          </p>
        </div>
      )}
    </div>
  );
}
