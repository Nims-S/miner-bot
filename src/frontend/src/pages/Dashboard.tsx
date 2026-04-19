import {
  Activity,
  AlertTriangle,
  BarChart3,
  Cpu,
  Flame,
  Shield,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { updateControl } from "../api/traderApi";
import ErrorMessage from "../components/ui/ErrorMessage";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import SignalBadge from "../components/ui/SignalBadge";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import { useTradingStore } from "../store/tradingStore";
import type { BackendPosition, Control } from "../types/trading";

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function fmtPrice(v: number): string {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtUsd(v: number): string {
  const abs = Math.abs(v);
  const sign = v >= 0 ? "+" : "-";
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(epochSec: number): string {
  const diffMs = Date.now() - epochSec * 1000;
  const s = Math.floor(diffMs / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function getPriceLookup(
  binancePrices: Record<string, number>,
  symbol: string,
): number | null {
  const ticker = symbol
    .replace("/USDT", "")
    .replace("USDT", "")
    .replace("-USDT", "");
  const val =
    binancePrices[ticker] ??
    binancePrices[symbol] ??
    binancePrices[`${ticker}USDT`] ??
    binancePrices[`${ticker}/USDT`] ??
    null;
  return val && val > 0 ? val : null;
}

// ─────────────────────────────────────────────────────────
// Mini toggle
// ─────────────────────────────────────────────────────────

function MiniToggle({
  checked,
  onChange,
  disabled,
  ocid,
  colorOn = "rgba(57,255,20,0.35)",
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  ocid: string;
  colorOn?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-ocid={ocid}
      onClick={onChange}
      disabled={disabled}
      className="relative flex-shrink-0 w-9 h-5 rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: checked ? colorOn : "rgba(255,255,255,0.1)" }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
        style={{ left: checked ? "calc(100% - 18px)" : "2px" }}
      />
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// Price source labels
// ─────────────────────────────────────────────────────────

const PRICE_SOURCE_LABELS: Record<string, string> = {
  coingecko: "CoinGecko",
  coincap: "CoinCap",
  cached: "Cached",
};

const PRICE_SOURCE_STYLES: Record<
  string,
  { color: string; bg: string; border: string }
> = {
  // CoinGecko is primary/healthy — green
  coingecko: {
    color: "rgba(57,255,20,0.9)",
    bg: "rgba(57,255,20,0.08)",
    border: "rgba(57,255,20,0.25)",
  },
  // CoinCap is fallback — amber/yellow
  coincap: {
    color: "rgba(255,193,7,0.9)",
    bg: "rgba(255,193,7,0.08)",
    border: "rgba(255,193,7,0.25)",
  },
  // Cached — orange (stale data warning)
  cached: {
    color: "#f0b429",
    bg: "rgba(240,180,41,0.08)",
    border: "rgba(240,180,41,0.2)",
  },
};

// ─────────────────────────────────────────────────────────
// Bot status bar
// ─────────────────────────────────────────────────────────

function BotStatusBar() {
  const { botStatus, connectionStatus, priceSource } = useTradingStore();

  const connDot = (() => {
    if (connectionStatus === "connected") return "pulse-dot-green";
    if (connectionStatus === "disconnected") return "pulse-dot-blue";
    return "pulse-dot-red";
  })();

  const connLabel = (() => {
    if (connectionStatus === "connected") return "Live";
    if (connectionStatus === "disconnected") return "Reconnecting";
    return "Unreachable";
  })();

  if (!botStatus) {
    return (
      <div
        data-ocid="bot_status_bar.loading_state"
        className="status-bar animate-pulse"
        style={{ background: "rgba(0,0,0,0.3)" }}
      >
        <div className="flex items-center gap-2">
          <span className="h-3 w-20 bg-[rgba(255,255,255,0.07)] rounded" />
          <span className="h-3 w-14 bg-[rgba(255,255,255,0.05)] rounded" />
        </div>
        <div className="h-3 w-16 bg-[rgba(255,255,255,0.05)] rounded" />
      </div>
    );
  }

  const isRunning =
    botStatus.status?.toLowerCase().includes("alive") ||
    botStatus.status?.toLowerCase().includes("run") ||
    botStatus.status?.toLowerCase().includes("ok") ||
    botStatus.status?.toLowerCase().includes("healthy");

  return (
    <div
      data-ocid="bot_status_bar.panel"
      className="status-bar"
      style={{ background: "rgba(0,0,0,0.35)", borderRadius: "10px" }}
    >
      {/* Left: bot status + version */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="status-item">
          <Cpu size={11} className="text-[rgba(226,232,240,0.4)]" />
          <span
            data-ocid="bot_status_bar.status_badge"
            className="font-mono font-bold text-[10px] px-2 py-0.5 rounded tracking-widest"
            style={{
              background: isRunning
                ? "rgba(57,255,20,0.12)"
                : "rgba(255,68,68,0.12)",
              color: isRunning ? "#39ff14" : "#ff4444",
              border: `1px solid ${isRunning ? "rgba(57,255,20,0.25)" : "rgba(255,68,68,0.25)"}`,
            }}
          >
            {isRunning ? "RUNNING" : "STOPPED"}
          </span>
        </div>
        {botStatus.version && (
          <div className="status-item hidden sm:flex">
            <span className="status-label">v</span>
            <span className="status-value text-[#00d9ff]">
              {botStatus.version}
            </span>
          </div>
        )}
        {botStatus.server_time > 0 && (
          <div className="status-item hidden md:flex">
            <span className="status-label">Server</span>
            <span className="status-value text-[rgba(226,232,240,0.6)]">
              {timeAgo(botStatus.server_time)}
            </span>
          </div>
        )}
      </div>

      {/* Right: price source indicator + connection status */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {priceSource && PRICE_SOURCE_LABELS[priceSource] && (
          <span
            data-ocid="bot_status_bar.price_source_badge"
            className="hidden sm:inline-flex items-center font-mono text-[9px] px-1.5 py-0.5 rounded tracking-wide"
            style={{
              color: PRICE_SOURCE_STYLES[priceSource]?.color,
              background: PRICE_SOURCE_STYLES[priceSource]?.bg,
              border: `1px solid ${PRICE_SOURCE_STYLES[priceSource]?.border}`,
            }}
          >
            {PRICE_SOURCE_LABELS[priceSource]}
          </span>
        )}
        <span className={connDot} />
        <span
          data-ocid="bot_status_bar.connection_label"
          className="font-mono text-[10px] text-[rgba(226,232,240,0.5)]"
        >
          {connLabel}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Position visualization bar (for backendPositions)
// ─────────────────────────────────────────────────────────

function PositionBar({ pos }: { pos: BackendPosition }) {
  const { binancePrices } = useTradingStore();
  const livePrice = getPriceLookup(binancePrices, pos.symbol);
  const current =
    livePrice ?? (pos.current_price > 0 ? pos.current_price : pos.entry);

  const sl = pos.sl;
  const entry = pos.entry;
  const tp = pos.tp;
  if (!entry || !sl || !tp) return null;

  const allValues = [sl, entry, tp, current];
  const low = Math.min(...allValues) * 0.9995;
  const high = Math.max(...allValues) * 1.0005;
  const range = high - low || 1;
  const pct = (v: number) =>
    Math.max(0.5, Math.min(99.5, ((v - low) / range) * 100));
  const pnl = ((current - entry) / entry) * 100;
  const isProfit = pnl >= 0;

  return (
    <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
      <div className="flex items-center justify-between mb-2 text-[11px]">
        <span className="text-[rgba(226,232,240,0.4)] font-mono">
          Position P&amp;L
        </span>
        <span
          className={`font-mono font-bold ${isProfit ? "text-[#39ff14]" : "text-[#ff4444]"}`}
        >
          {isProfit ? "+" : ""}
          {pnl.toFixed(2)}%
        </span>
      </div>
      <div className="relative h-2.5 rounded-full overflow-visible bg-[rgba(255,255,255,0.05)]">
        <div
          className="absolute top-0 h-2.5 rounded-l-full"
          style={{
            left: `${pct(Math.min(sl, entry))}%`,
            width: `${Math.abs(pct(entry) - pct(sl))}%`,
            background:
              "linear-gradient(90deg, rgba(255,68,68,0.15), rgba(255,68,68,0.4))",
          }}
        />
        <div
          className="absolute top-0 h-2.5 rounded-r-full"
          style={{
            left: `${pct(entry)}%`,
            width: `${Math.abs(pct(tp) - pct(entry))}%`,
            background:
              "linear-gradient(90deg, rgba(57,255,20,0.2), rgba(57,255,20,0.5))",
          }}
        />
        {[
          { val: sl, color: "#ff4444", size: "w-2 h-2" },
          { val: entry, color: "rgba(226,232,240,0.7)", size: "w-2.5 h-2.5" },
          { val: tp, color: "#00d9ff", size: "w-2 h-2" },
        ].map(({ val, color, size }) => (
          <div
            key={val}
            className={`absolute top-1/2 ${size} rounded-full`}
            style={{
              left: `${pct(val)}%`,
              transform: "translate(-50%, -50%)",
              background: color,
            }}
          />
        ))}
        <div
          className="absolute top-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg transition-all duration-500"
          style={{
            left: `${pct(current)}%`,
            transform: "translate(-50%, -50%)",
            background: isProfit ? "#39ff14" : "#ff4444",
            boxShadow: isProfit
              ? "0 0 8px rgba(57,255,20,0.7)"
              : "0 0 8px rgba(255,68,68,0.7)",
          }}
        />
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] font-mono">
        <span className="text-[rgba(226,232,240,0.3)]">{fmtPrice(sl)}</span>
        <span className="text-[rgba(226,232,240,0.5)]">
          Now:{" "}
          <span className={isProfit ? "text-[#39ff14]" : "text-[#ff4444]"}>
            {fmtPrice(current)}
          </span>
        </span>
        <span className="text-[rgba(226,232,240,0.3)]">{fmtPrice(tp)}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Position card (from /api/v2/positions)
// ─────────────────────────────────────────────────────────

const TICKER_META: Record<string, { color: string }> = {
  BTC: { color: "#f7931a" },
  ETH: { color: "#627eea" },
  SOL: { color: "#9945ff" },
};

function PositionCard({
  pos,
  index,
}: {
  pos: BackendPosition;
  index: number;
}) {
  const { binancePrices } = useTradingStore();
  const ticker = pos.symbol.replace("/USDT", "").replace("USDT", "");
  const meta = TICKER_META[ticker] ?? { color: "#00d9ff" };
  const livePrice = getPriceLookup(binancePrices, pos.symbol);
  const displayPrice =
    livePrice ?? (pos.current_price > 0 ? pos.current_price : null);
  const pnl = pos.pnl ?? 0;
  const isProfit = pnl >= 0;

  return (
    <div
      data-ocid={`dashboard.position_card.item.${index + 1}`}
      className="border border-[rgba(0,217,255,0.18)] bg-[rgba(0,217,255,0.03)] rounded-[14px] backdrop-blur-md p-4 flex flex-col gap-3 transition-colors duration-300"
      style={{
        boxShadow: "0 0 24px rgba(0,217,255,0.07), 0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
            style={{
              background: `${meta.color}18`,
              color: meta.color,
              border: `1px solid ${meta.color}35`,
            }}
          >
            {ticker[0]}
          </div>
          <div className="min-w-0">
            <span className="font-bold text-sm text-[#e2e8f0]">
              {pos.symbol}
            </span>
            {pos.strategy && pos.strategy !== "unknown" && (
              <p className="text-[10px] text-[rgba(0,217,255,0.6)] mt-0.5 font-mono truncate">
                {pos.strategy.replace(/_/g, " ")}
              </p>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {displayPrice ? (
            <span className="font-mono text-base font-bold text-[#00d9ff]">
              ${fmtPrice(displayPrice)}
            </span>
          ) : (
            <span className="text-[10px] text-[rgba(226,232,240,0.3)] font-mono">
              --
            </span>
          )}
        </div>
      </div>

      {/* Position details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
        {[
          {
            label: "Entry",
            value: `$${fmtPrice(pos.entry)}`,
            color: "#e2e8f0",
          },
          {
            label: "Stop Loss",
            value: `$${fmtPrice(pos.sl)}`,
            color: "#ff4444",
          },
          { label: "TP1", value: `$${fmtPrice(pos.tp)}`, color: "#39ff14" },
          { label: "Size", value: String(pos.size), color: "#e2e8f0" },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p className="text-[rgba(226,232,240,0.35)] uppercase tracking-wider mb-0.5">
              {label}
            </p>
            <p className="font-mono font-semibold" style={{ color }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Unrealized PnL */}
      <div className="flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.06)]">
        <span className="text-[11px] text-[rgba(226,232,240,0.45)]">
          Unrealized PnL
        </span>
        <span
          className={`font-mono font-bold text-sm ${isProfit ? "text-[#39ff14]" : "text-[#ff4444]"}`}
        >
          {fmtUsd(pnl)}
        </span>
      </div>

      {/* Position bar */}
      <PositionBar pos={pos} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Global control panel
// ─────────────────────────────────────────────────────────

function GlobalControlPanel() {
  const { controls, updateControlOptimistic, rollbackControl } =
    useTradingStore();
  const [busy, setBusy] = useState(false);

  const globalCtrl = (Array.isArray(controls) ? controls : []).find(
    (c) => c.scope === "GLOBAL" || c.scope === "global",
  );
  const isEnabled = globalCtrl?.enabled ?? true;
  const isFlatten = globalCtrl?.flatten_on_disable ?? false;

  const handleToggleTrading = async () => {
    if (!globalCtrl || busy) return;
    const prev = { ...globalCtrl };
    setBusy(true);
    updateControlOptimistic(globalCtrl.scope, !isEnabled);
    try {
      await updateControl({
        scope: "GLOBAL",
        enabled: !isEnabled,
        flatten_on_disable: isFlatten,
      });
      toast.success(!isEnabled ? "Trading enabled" : "Trading disabled");
    } catch {
      rollbackControl(globalCtrl.scope, prev);
      toast.error("Failed to update control");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleFlatten = async () => {
    if (!globalCtrl || busy) return;
    const prev = { ...globalCtrl };
    setBusy(true);
    updateControlOptimistic(globalCtrl.scope, isEnabled, !isFlatten);
    try {
      await updateControl({
        scope: "GLOBAL",
        enabled: isEnabled,
        flatten_on_disable: !isFlatten,
      });
      toast.success(`Emergency flatten ${!isFlatten ? "armed" : "disarmed"}`);
    } catch {
      rollbackControl(globalCtrl.scope, prev);
      toast.error("Failed to update control");
    } finally {
      setBusy(false);
    }
  };

  const handleKillAll = async () => {
    if (busy) return;
    const confirmed = window.confirm(
      "⚠ Kill All Positions — this will disable trading and flatten all open positions. Confirm?",
    );
    if (!confirmed) return;
    setBusy(true);
    if (globalCtrl) {
      const prev = { ...globalCtrl };
      updateControlOptimistic(globalCtrl.scope, false, true);
      try {
        await updateControl({
          scope: "GLOBAL",
          enabled: false,
          flatten_on_disable: true,
        });
        toast.error("Kill All triggered — all positions will be closed.", {
          duration: 6000,
        });
      } catch {
        rollbackControl(globalCtrl.scope, prev);
        toast.error("Failed to send kill all signal");
      }
    }
    setBusy(false);
  };

  return (
    <div data-ocid="control_panel.card" className="glass-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={13} className="text-[#00d9ff]" />
        <h2 className="text-xs font-semibold text-[#e2e8f0]">Control Panel</h2>
        <span
          className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{
            background: isEnabled
              ? "rgba(57,255,20,0.08)"
              : "rgba(255,68,68,0.08)",
            color: isEnabled ? "#39ff14" : "#ff4444",
          }}
        >
          {isEnabled ? "ACTIVE" : "HALTED"}
        </span>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#e2e8f0]">Enable Trading</p>
            <p className="text-[10px] text-[rgba(226,232,240,0.4)] mt-0.5">
              Global on/off switch
            </p>
          </div>
          <MiniToggle
            checked={isEnabled}
            onChange={handleToggleTrading}
            disabled={busy}
            ocid="global_controls.trading.toggle"
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#e2e8f0]">
              Emergency Flatten
            </p>
            <p className="text-[10px] text-[rgba(226,232,240,0.4)] mt-0.5">
              Close all on disable
            </p>
          </div>
          <MiniToggle
            checked={isFlatten}
            onChange={handleToggleFlatten}
            disabled={busy}
            ocid="global_controls.flatten.toggle"
            colorOn="rgba(240,180,41,0.4)"
          />
        </div>
        <button
          type="button"
          data-ocid="global_controls.kill_all.button"
          onClick={handleKillAll}
          disabled={busy}
          className="w-full py-2.5 rounded-xl text-xs font-bold tracking-wide bg-[rgba(255,68,68,0.1)] border border-[rgba(255,68,68,0.3)] text-[#ff4444] hover:bg-[rgba(255,68,68,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transition-smooth flex items-center justify-center gap-2"
        >
          <Flame size={13} />
          Kill All Positions
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Asset controls (per-asset kill switches)
// ─────────────────────────────────────────────────────────

function AssetControlList() {
  const { controls, updateControlOptimistic, rollbackControl } =
    useTradingStore();
  const [busy, setBusy] = useState<string | null>(null);

  const assetControls = (Array.isArray(controls) ? controls : []).filter(
    (c) => c.scope !== "GLOBAL" && c.scope !== "global",
  );

  if (assetControls.length === 0) return null;

  const handleToggle = async (ctrl: Control) => {
    if (busy) return;
    const prev = { ...ctrl };
    setBusy(ctrl.scope);
    updateControlOptimistic(ctrl.scope, !ctrl.enabled);
    try {
      await updateControl({ scope: ctrl.scope, enabled: !ctrl.enabled });
      toast.success(`${ctrl.scope} ${!ctrl.enabled ? "enabled" : "killed"}`);
    } catch {
      rollbackControl(ctrl.scope, prev);
      toast.error(`Failed to update ${ctrl.scope}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={13} className="text-[#00d9ff]" />
        <h3 className="text-xs font-semibold text-[#e2e8f0]">Asset Controls</h3>
      </div>
      <div className="space-y-2">
        {assetControls.map((ctrl, i) => (
          <div
            key={ctrl.scope}
            data-ocid={`dashboard.asset_control.item.${i + 1}`}
            className="flex items-center justify-between py-1"
          >
            <span className="text-xs font-mono text-[rgba(226,232,240,0.65)]">
              {ctrl.scope}
            </span>
            <MiniToggle
              checked={ctrl.enabled}
              onChange={() => handleToggle(ctrl)}
              disabled={busy === ctrl.scope}
              ocid={`dashboard.asset_control.toggle.${i + 1}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const {
    binancePrices,
    isLoading,
    error,
    backendTrades,
    backendTradesTotal,
    controls,
    connectionStatus,
    backendPositions,
    botStatus,
    overviewData,
  } = useTradingStore();

  // Track whether price feed has been absent for >15s
  const [priceFeedUnavailable, setPriceFeedUnavailable] = useState(false);
  useEffect(() => {
    const hasPrices = Object.keys(binancePrices).length > 0;
    if (hasPrices) {
      setPriceFeedUnavailable(false);
      return;
    }
    const t = setTimeout(() => {
      if (Object.keys(useTradingStore.getState().binancePrices).length === 0) {
        setPriceFeedUnavailable(true);
      }
    }, 15000);
    return () => clearTimeout(t);
  }, [binancePrices]);

  const globalCtrl = (Array.isArray(controls) ? controls : []).find(
    (c) => c.scope === "GLOBAL" || c.scope === "global",
  );
  const isGlobalEnabled = globalCtrl?.enabled ?? true;

  const { winRate, totalPnl } = useMemo(() => {
    const wins = backendTrades.filter((t) => (t.pnl ?? 0) > 0).length;
    const wr =
      backendTrades.length > 0 ? (wins / backendTrades.length) * 100 : null;
    const tPnl = backendTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    return { winRate: wr, totalPnl: tPnl };
  }, [backendTrades]);

  const isPaused = !isGlobalEnabled;

  // Show loading only on initial load (no data yet)
  const hasAnyData =
    overviewData !== null || backendPositions.length > 0 || controls.length > 0;

  if (isLoading && !hasAnyData) {
    return (
      <div
        data-ocid="dashboard.loading_state"
        className="flex items-center justify-center min-h-[60vh] gap-3"
      >
        <LoadingSpinner size="lg" />
        <span className="text-[rgba(226,232,240,0.5)] text-sm animate-pulse">
          Connecting to bot...
        </span>
      </div>
    );
  }

  if (error && !hasAnyData) {
    return (
      <div className="p-4 lg:p-6">
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div
      data-ocid="dashboard.page"
      className="p-4 lg:p-6 space-y-4 animate-fade-in-up"
      style={{ opacity: isPaused ? 0.88 : 1, transition: "opacity 0.4s ease" }}
    >
      {/* Bot status bar */}
      <BotStatusBar />

      {/* Backend unreachable banner */}
      {connectionStatus === "error" && (
        <div
          data-ocid="dashboard.backend_error_banner"
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[rgba(255,68,68,0.4)] bg-[rgba(255,68,68,0.08)] text-[#ff4444] text-sm font-semibold"
          style={{ boxShadow: "0 0 20px rgba(255,68,68,0.1)" }}
        >
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>Reconnecting to trading server...</span>
        </div>
      )}

      {/* System paused banner */}
      {isPaused && (
        <div
          data-ocid="dashboard.paused_banner"
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[rgba(255,140,0,0.4)] bg-[rgba(255,140,0,0.08)] text-[#ff9800] text-sm font-semibold"
          style={{ boxShadow: "0 0 20px rgba(255,140,0,0.12)" }}
        >
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>⚠ SYSTEM PAUSED — Trading is disabled</span>
        </div>
      )}

      {/* Price feed unavailable banner */}
      {priceFeedUnavailable && (
        <div
          data-ocid="dashboard.price_feed_banner"
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[rgba(240,180,41,0.3)] bg-[rgba(240,180,41,0.06)] text-[#f0b429] text-xs font-medium"
        >
          <WifiOff size={13} className="flex-shrink-0" />
          <span>
            Price feed unavailable — CoinGecko and CoinCap may be rate-limiting
            or unreachable. Prices will resume automatically.
          </span>
          <Wifi size={13} className="flex-shrink-0 ml-auto opacity-40" />
        </div>
      )}

      {/* Stats row — driven by /api/v2/overview */}
      <div
        data-ocid="dashboard.stats.section"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <StatCard
          label="Total PNL"
          value={
            overviewData !== null
              ? `${overviewData.total_pnl >= 0 ? "+" : ""}$${Math.abs(overviewData.total_pnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : backendTrades.length > 0
                ? `${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "$0.00"
          }
          subtitle={`${backendTradesTotal > 0 ? backendTradesTotal : backendTrades.length} closed trades`}
          valueColor={
            (overviewData?.total_pnl ?? totalPnl) > 0
              ? "green"
              : (overviewData?.total_pnl ?? totalPnl) < 0
                ? "red"
                : "default"
          }
        />
        <StatCard
          label="Win Rate"
          value={winRate !== null ? `${winRate.toFixed(1)}%` : "—"}
          subtitle={`${backendTrades.filter((t) => (t.pnl ?? 0) > 0).length} wins`}
          valueColor={winRate !== null && winRate > 50 ? "green" : "default"}
        />
        <StatCard
          label="Daily PNL"
          value={
            overviewData !== null
              ? `${overviewData.daily_pnl >= 0 ? "+" : ""}$${Math.abs(overviewData.daily_pnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "—"
          }
          subtitle="from /api/v2/overview"
          valueColor={
            (overviewData?.daily_pnl ?? 0) > 0
              ? "green"
              : (overviewData?.daily_pnl ?? 0) < 0
                ? "red"
                : "default"
          }
        />
        <StatCard
          label="Balance"
          value={
            overviewData !== null && overviewData.equity > 0
              ? `$${overviewData.equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "--"
          }
          subtitle={
            overviewData
              ? `${overviewData.open_positions} open positions`
              : "No overview data"
          }
          valueColor="blue"
        />
      </div>

      {/* Main grid: positions + right panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-4">
        {/* Open positions from /api/v2/positions */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-[#00d9ff]" />
            <h2 className="text-sm font-semibold text-[#e2e8f0]">
              Open Positions
            </h2>
            <span className="ml-2 text-[10px] font-mono text-[rgba(226,232,240,0.35)]">
              via /api/v2/positions
            </span>
          </div>

          {backendPositions.length === 0 ? (
            <div
              data-ocid="dashboard.positions.empty_state"
              className="glass-card p-10 text-center"
            >
              <Activity
                size={36}
                className="text-[rgba(226,232,240,0.15)] mx-auto mb-3"
              />
              <p className="text-sm text-[rgba(226,232,240,0.5)]">
                No open positions
              </p>
              <p className="text-xs text-[rgba(226,232,240,0.3)] mt-1">
                Bot is monitoring markets — positions will appear here when
                entered.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {backendPositions.map((pos, i) => (
                <PositionCard key={`${pos.symbol}-${i}`} pos={pos} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <GlobalControlPanel />
          <AssetControlList />

          {/* Recent trades from /api/v2/trades */}
          {backendTrades.length > 0 && (
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={13} className="text-[#39ff14]" />
                <h3 className="text-xs font-semibold text-[#e2e8f0]">
                  Recent Trades
                </h3>
              </div>
              <div className="space-y-2">
                {backendTrades.slice(0, 5).map((t, i) => (
                  <div
                    key={`${t.symbol}-${t.timestamp}-${i}`}
                    data-ocid={`dashboard.recent_trades.item.${i + 1}`}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {(t.pnl ?? 0) >= 0 ? (
                        <TrendingUp
                          size={10}
                          className="text-[#39ff14] flex-shrink-0"
                        />
                      ) : (
                        <TrendingDown
                          size={10}
                          className="text-[#ff4444] flex-shrink-0"
                        />
                      )}
                      <span className="text-[rgba(226,232,240,0.6)] font-mono truncate">
                        {t.symbol}
                      </span>
                    </div>
                    <span
                      className={`font-mono font-semibold flex-shrink-0 transition-colors duration-300 ${(t.pnl ?? 0) >= 0 ? "text-[#39ff14]" : "text-[#ff4444]"}`}
                    >
                      {(t.pnl ?? 0) >= 0
                        ? `+$${(t.pnl ?? 0).toFixed(2)}`
                        : `-$${Math.abs(t.pnl ?? 0).toFixed(2)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bot info card */}
          {botStatus && (
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={13} className="text-[#f0b429]" />
                <h3 className="text-xs font-semibold text-[#e2e8f0]">
                  Bot Info
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                {[
                  { label: "Status", value: botStatus.status },
                  { label: "Version", value: botStatus.version },
                  {
                    label: "Server Time",
                    value:
                      botStatus.server_time > 0
                        ? new Date(
                            botStatus.server_time * 1000,
                          ).toLocaleTimeString()
                        : "—",
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[rgba(226,232,240,0.4)] uppercase tracking-wider text-[10px]">
                      {label}
                    </span>
                    <span className="font-mono text-[rgba(226,232,240,0.7)]">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
