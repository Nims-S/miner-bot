import { format, parseISO } from "date-fns";
import {
  ArrowDownUp,
  ArrowUpDown,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Star,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTradingStore } from "../store/tradingStore";
import type { BackendTrade } from "../types/trading";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeFormatDate(ts: string | undefined, fmt: string): string {
  if (!ts) return "";
  try {
    const d = parseISO(ts);
    if (Number.isNaN(d.getTime())) return "";
    return format(d, fmt);
  } catch {
    return "";
  }
}

function safeParseTime(ts: string | undefined): number {
  if (!ts) return 0;
  try {
    const t = parseISO(ts).getTime();
    return Number.isNaN(t) ? 0 : t;
  } catch {
    return 0;
  }
}

/** Format PnL as "-$X.XX" (not "$-X.XX") */
function formatPnl(val: number, showPlus = false): string {
  const abs = Math.abs(val).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (val < 0) return `-$${abs}`;
  if (showPlus && val > 0) return `+$${abs}`;
  return `$${abs}`;
}

/** Format strategy string: "breakout_momentum" → "Breakout Momentum" */
function formatStrategy(strategy: string): string {
  if (!strategy || strategy === "unknown") return "Unknown";
  return strategy
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Clean symbol display: "BTC/USDT" → "BTC" + "/USDT" */
function splitSymbol(sym: string): { base: string; quote: string } {
  const [base, quote] = sym.includes("/")
    ? sym.split("/")
    : [sym.replace("USDT", ""), "USDT"];
  return { base, quote: quote ?? "USDT" };
}

// ─── Types ───────────────────────────────────────────────────────────────────

type SortCol = "date" | "pnl";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 10;

// ─── Custom Tooltips ─────────────────────────────────────────────────────────

interface ChartTooltipProps {
  active?: boolean;
  payload?: { value: number; payload: { label?: string; date?: string } }[];
  label?: string;
}

function EquityTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  return (
    <div
      className="px-3 py-2 text-xs rounded-lg border"
      style={{
        background: "rgba(11,15,20,0.95)",
        borderColor: "rgba(0,217,255,0.2)",
        backdropFilter: "blur(8px)",
      }}
    >
      <p className="text-[rgba(226,232,240,0.45)] mb-1 text-[10px]">
        Trade #{label}
      </p>
      <p
        className={`font-mono font-bold ${val >= 0 ? "text-[#39ff14]" : "text-[#ff4444]"}`}
      >
        {formatPnl(val, true)}
      </p>
    </div>
  );
}

function DailyTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  return (
    <div
      className="px-3 py-2 text-xs rounded-lg border"
      style={{
        background: "rgba(11,15,20,0.95)",
        borderColor: "rgba(0,217,255,0.2)",
        backdropFilter: "blur(8px)",
      }}
    >
      <p className="text-[rgba(226,232,240,0.45)] mb-1 text-[10px]">{label}</p>
      <p
        className={`font-mono font-bold ${val >= 0 ? "text-[#39ff14]" : "text-[#ff4444]"}`}
      >
        {formatPnl(val, true)}
      </p>
    </div>
  );
}

// ─── Sort Icon ────────────────────────────────────────────────────────────────

function SortIcon({ col, sortCol }: { col: SortCol; sortCol: SortCol }) {
  if (col !== sortCol)
    return (
      <ArrowUpDown
        size={10}
        className="text-[rgba(226,232,240,0.2)] ml-1 inline"
      />
    );
  return <ArrowDownUp size={10} className="text-[#00d9ff] ml-1 inline" />;
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color?: string;
}
function StatCard({ label, value, sub, icon, color }: StatCardProps) {
  return (
    <div
      className="flex flex-col gap-1 rounded-xl px-4 py-3 border"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderColor: "rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon}
        <p className="text-[10px] uppercase tracking-widest text-[rgba(226,232,240,0.35)] font-medium">
          {label}
        </p>
      </div>
      <p
        className="text-2xl font-bold font-mono leading-none"
        style={{ color: color ?? "#e2e8f0" }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-[rgba(226,232,240,0.3)] mt-0.5">{sub}</p>
      )}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      data-ocid="trades.empty_state"
      className="flex flex-col items-center justify-center py-16 text-center px-6"
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border"
        style={{
          background: "rgba(0,217,255,0.05)",
          borderColor: "rgba(0,217,255,0.12)",
        }}
      >
        <TrendingUp size={28} className="text-[rgba(0,217,255,0.35)]" />
      </div>
      <p className="text-sm font-medium text-[rgba(226,232,240,0.55)]">
        No trades recorded yet — positions will appear here as they close.
      </p>
      <p className="text-xs text-[rgba(226,232,240,0.25)] mt-2 max-w-xs">
        The bot is actively monitored. Trade history accumulates automatically
        as positions open and close.
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Trades() {
  const { backendTrades, backendTradesTotal, tradeHistory } = useTradingStore();

  // Primary: backendTrades from /api/v2/trades endpoint
  // Fallback: derive from tradeHistory if backendTrades is empty
  const rawTrades: BackendTrade[] = useMemo(() => {
    if (backendTrades && backendTrades.length > 0) return backendTrades;
    return tradeHistory
      .filter((t) => t.status === "CLOSED")
      .map((t) => ({
        symbol: t.symbol,
        entry: t.entry,
        exit: t.exit,
        pnl: t.pnl,
        strategy: t.direction ?? "unknown",
        timestamp: t.date,
      }));
  }, [backendTrades, tradeHistory]);

  const hasNoTrades = rawTrades.length === 0;

  // ── Symbol filter ────────────────────────────────────────────────────────
  const uniqueSymbols = useMemo(() => {
    const s = new Set(rawTrades.map((t) => t.symbol));
    return ["ALL", ...Array.from(s).sort()];
  }, [rawTrades]);

  const [symbolFilter, setSymbolFilter] = useState<string>("ALL");
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("desc");
    }
    setPage(1);
  }

  // ── Stats (all trades, no filter) ────────────────────────────────────────
  const stats = useMemo(() => {
    // Use backend total for accurate count when available
    const total =
      backendTradesTotal > 0 ? backendTradesTotal : rawTrades.length;
    const wins = rawTrades.filter((t) => (t.pnl ?? 0) > 0);
    const totalPnl = rawTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const winRate =
      rawTrades.length > 0 ? (wins.length / rawTrades.length) * 100 : 0;
    const bestTrade = rawTrades.reduce<BackendTrade | null>((best, t) => {
      if (!best) return t;
      return (t.pnl ?? Number.NEGATIVE_INFINITY) >
        (best.pnl ?? Number.NEGATIVE_INFINITY)
        ? t
        : best;
    }, null);
    return {
      total,
      displayedCount: rawTrades.length,
      wins: wins.length,
      totalPnl,
      winRate,
      bestTrade,
    };
  }, [rawTrades, backendTradesTotal]);

  // ── Equity Curve ─────────────────────────────────────────────────────────
  const equityData = useMemo(() => {
    const sorted = [...rawTrades]
      .filter((t) => safeParseTime(t.timestamp) > 0)
      .sort((a, b) => safeParseTime(a.timestamp) - safeParseTime(b.timestamp));
    let cum = 0;
    return sorted.map((t, i) => {
      cum += t.pnl ?? 0;
      return {
        label: String(i + 1),
        cumPnl: Math.round(cum * 100) / 100,
      };
    });
  }, [rawTrades]);

  // ── Daily PnL ─────────────────────────────────────────────────────────────
  const dailyPnlData = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of rawTrades) {
      const key = safeFormatDate(t.timestamp, "MMM d");
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + (t.pnl ?? 0));
    }
    return Array.from(map.entries())
      .map(([date, dailyPnl]) => ({
        date,
        dailyPnl: Math.round(dailyPnl * 100) / 100,
      }))
      .slice(-30);
  }, [rawTrades]);

  // ── Filtered + sorted table ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rawTrades.filter((t) => {
      if (symbolFilter !== "ALL" && t.symbol !== symbolFilter) return false;
      return true;
    });
  }, [rawTrades, symbolFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: number;
      let vb: number;
      if (sortCol === "pnl") {
        va = a.pnl ?? 0;
        vb = b.pnl ?? 0;
      } else {
        va = safeParseTime(a.timestamp);
        vb = safeParseTime(b.timestamp);
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortCol, sortDir]);

  // Use backend total for pagination when all trades haven't been fetched locally
  const effectiveTotal =
    backendTradesTotal > sorted.length ? backendTradesTotal : sorted.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = effectiveTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, effectiveTotal);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Page Header */}
      <div className="flex items-center gap-2">
        <BarChart2 size={18} className="text-[#00d9ff]" />
        <h1 className="text-lg font-bold text-[#e2e8f0]">Trade Analytics</h1>
        <span
          className="ml-2 px-2 py-0.5 rounded text-[10px] font-semibold border"
          style={{
            borderColor: "rgba(57,255,20,0.25)",
            color: "#39ff14",
            background: "rgba(57,255,20,0.07)",
          }}
        >
          Live Data
        </span>
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        data-ocid="trades.stats.section"
      >
        <StatCard
          label="Total Trades"
          value={hasNoTrades ? "--" : String(stats.total)}
          sub={
            hasNoTrades
              ? "no data yet"
              : `${stats.wins}W / ${stats.total - stats.wins}L`
          }
          icon={<BarChart2 size={11} className="text-[#00d9ff]" />}
        />
        <StatCard
          label="Win Rate"
          value={hasNoTrades ? "--" : `${stats.winRate.toFixed(1)}%`}
          sub={
            hasNoTrades
              ? "no data yet"
              : `of ${stats.displayedCount} loaded trades`
          }
          icon={
            <TrendingUp
              size={11}
              className={
                stats.winRate >= 50 ? "text-[#39ff14]" : "text-[#ff4444]"
              }
            />
          }
          color={
            hasNoTrades
              ? "rgba(226,232,240,0.3)"
              : stats.winRate >= 50
                ? "#39ff14"
                : "#ff4444"
          }
        />
        <StatCard
          label="Total PnL"
          value={hasNoTrades ? "--" : formatPnl(stats.totalPnl, true)}
          sub="from loaded trades"
          icon={
            <Star
              size={11}
              className={
                stats.totalPnl >= 0 ? "text-[#39ff14]" : "text-[#ff4444]"
              }
            />
          }
          color={
            hasNoTrades
              ? "rgba(226,232,240,0.3)"
              : stats.totalPnl >= 0
                ? "#39ff14"
                : "#ff4444"
          }
        />
        <StatCard
          label="Best Trade"
          value={
            hasNoTrades || !stats.bestTrade
              ? "--"
              : formatPnl(stats.bestTrade.pnl ?? 0, true)
          }
          sub={
            stats.bestTrade
              ? splitSymbol(stats.bestTrade.symbol).base
              : "no data yet"
          }
          icon={<Trophy size={11} className="text-[#f59e0b]" />}
          color={hasNoTrades ? "rgba(226,232,240,0.3)" : "#f59e0b"}
        />
      </div>

      {/* ── Equity Curve ──────────────────────────────────────────────────── */}
      <div
        className="rounded-xl border p-4"
        style={{
          background: "rgba(255,255,255,0.025)",
          borderColor: "rgba(255,255,255,0.07)",
        }}
        data-ocid="trades.equity_curve.section"
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={13} className="text-[#00d9ff]" />
          <h3 className="text-sm font-semibold text-[#e2e8f0]">
            Equity Curve — Cumulative PnL
          </h3>
        </div>
        {hasNoTrades ? (
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-xs text-[rgba(226,232,240,0.25)]">
              No trade data yet
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart
              data={equityData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d9ff" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#00d9ff" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <ReferenceLine
                y={0}
                stroke="rgba(255,255,255,0.12)"
                strokeDasharray="4 4"
              />
              <XAxis
                dataKey="label"
                tick={{
                  fill: "rgba(226,232,240,0.35)",
                  fontSize: 10,
                  fontFamily: "JetBrains Mono, monospace",
                }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                label={{
                  value: "Trade #",
                  position: "insideBottomRight",
                  offset: -4,
                  fill: "rgba(226,232,240,0.2)",
                  fontSize: 10,
                }}
              />
              <YAxis
                tick={{
                  fill: "rgba(226,232,240,0.35)",
                  fontSize: 10,
                  fontFamily: "JetBrains Mono, monospace",
                }}
                axisLine={false}
                tickLine={false}
                width={62}
                tickFormatter={(v: number) =>
                  v >= 1000 || v <= -1000
                    ? `$${(v / 1000).toFixed(1)}k`
                    : `$${v.toFixed(0)}`
                }
              />
              <Tooltip
                content={<EquityTooltip />}
                cursor={{ stroke: "rgba(0,217,255,0.15)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="cumPnl"
                stroke="#00d9ff"
                strokeWidth={2}
                fill="url(#equityGrad)"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#00d9ff",
                  stroke: "rgba(0,217,255,0.3)",
                  strokeWidth: 6,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Daily PnL Bar Chart ───────────────────────────────────────────── */}
      <div
        className="rounded-xl border p-4"
        style={{
          background: "rgba(255,255,255,0.025)",
          borderColor: "rgba(255,255,255,0.07)",
        }}
        data-ocid="trades.daily_pnl.section"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={13} className="text-[rgba(226,232,240,0.4)]" />
          <h3 className="text-sm font-semibold text-[#e2e8f0]">Daily PnL</h3>
        </div>
        {hasNoTrades ? (
          <div className="flex items-center justify-center h-[140px]">
            <p className="text-xs text-[rgba(226,232,240,0.25)]">
              No trade data yet
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={dailyPnlData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
              <XAxis
                dataKey="date"
                tick={{
                  fill: "rgba(226,232,240,0.35)",
                  fontSize: 10,
                  fontFamily: "JetBrains Mono, monospace",
                }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{
                  fill: "rgba(226,232,240,0.35)",
                  fontSize: 10,
                  fontFamily: "JetBrains Mono, monospace",
                }}
                axisLine={false}
                tickLine={false}
                width={62}
                tickFormatter={(v: number) =>
                  v >= 1000 || v <= -1000
                    ? `$${(v / 1000).toFixed(1)}k`
                    : `$${v.toFixed(0)}`
                }
              />
              <Tooltip
                content={<DailyTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar dataKey="dailyPnl" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {dailyPnlData.map((entry, i) => (
                  <Cell
                    key={`bar-${entry.date}-${i}`}
                    fill={entry.dailyPnl >= 0 ? "#39ff14" : "#ff4444"}
                    fillOpacity={0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Trade History Table ───────────────────────────────────────────── */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.025)",
          borderColor: "rgba(255,255,255,0.07)",
        }}
        data-ocid="trades.history.section"
      >
        {/* Header row */}
        <div
          className="flex items-center justify-between px-4 pt-4 pb-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <h3 className="text-sm font-semibold text-[#e2e8f0]">
            Trade History
          </h3>
          <span className="text-xs text-[rgba(226,232,240,0.3)] font-mono">
            {backendTradesTotal > 0
              ? `${backendTradesTotal} total`
              : `${sorted.length} records`}
          </span>
        </div>

        {/* Filter row */}
        <div
          className="flex flex-wrap items-center gap-2 px-4 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <span className="text-[10px] uppercase tracking-wider text-[rgba(226,232,240,0.3)]">
            Symbol
          </span>
          <div
            className="flex flex-wrap gap-1"
            data-ocid="trades.symbol_filter.section"
          >
            {uniqueSymbols.map((sym) => {
              const label = sym === "ALL" ? "All" : splitSymbol(sym).base;
              return (
                <button
                  key={sym}
                  type="button"
                  data-ocid={`trades.symbol_filter.${sym.toLowerCase().replace("/", "")}.tab`}
                  onClick={() => {
                    setSymbolFilter(sym);
                    setPage(1);
                  }}
                  className="px-2.5 py-1 rounded text-[11px] font-medium transition-all border"
                  style={{
                    borderColor:
                      symbolFilter === sym
                        ? "rgba(0,217,255,0.35)"
                        : "transparent",
                    background:
                      symbolFilter === sym
                        ? "rgba(0,217,255,0.12)"
                        : "rgba(255,255,255,0.03)",
                    color:
                      symbolFilter === sym
                        ? "#00d9ff"
                        : "rgba(226,232,240,0.45)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table body */}
        {hasNoTrades ? (
          <EmptyState />
        ) : sorted.length === 0 ? (
          <div data-ocid="trades.empty_state" className="py-10 text-center">
            <p className="text-sm text-[rgba(226,232,240,0.35)]">
              No trades match this filter.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    {(
                      [
                        { col: "date", label: "Date" },
                        { col: null, label: "Symbol" },
                        { col: null, label: "Entry" },
                        { col: null, label: "Exit" },
                        { col: "pnl", label: "PnL" },
                        { col: null, label: "Strategy" },
                      ] as { col: SortCol | null; label: string }[]
                    ).map(({ col, label }) => (
                      <th key={label} className="px-0 py-0">
                        {col ? (
                          <button
                            type="button"
                            data-ocid={`trades.sort.${col}.button`}
                            onClick={() => handleSort(col)}
                            className="w-full px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-[rgba(226,232,240,0.3)] font-medium hover:text-[rgba(226,232,240,0.6)] select-none transition-colors"
                          >
                            {label}
                            <SortIcon col={col} sortCol={sortCol} />
                          </button>
                        ) : (
                          <div className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-[rgba(226,232,240,0.3)] font-medium">
                            {label}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((trade, i) => {
                    const isWin = (trade.pnl ?? 0) > 0;
                    const rowNum = (page - 1) * PAGE_SIZE + i + 1;
                    const { base, quote } = splitSymbol(trade.symbol);
                    return (
                      <tr
                        key={`${trade.symbol}-${trade.timestamp}-${i}`}
                        data-ocid={`trades.item.${rowNum}`}
                        className="transition-colors"
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.03)",
                          background:
                            i % 2 === 0 ? "rgba(15,23,33,0.4)" : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            "rgba(0,217,255,0.03)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            i % 2 === 0 ? "rgba(15,23,33,0.4)" : "transparent";
                        }}
                      >
                        <td className="px-3 py-2.5 font-mono text-[rgba(226,232,240,0.45)] whitespace-nowrap text-[11px]">
                          {safeFormatDate(trade.timestamp, "MMM dd, HH:mm") ||
                            trade.timestamp ||
                            "—"}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-[#e2e8f0]">
                          {base}
                          <span className="text-[rgba(226,232,240,0.3)] font-normal">
                            /{quote}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[rgba(226,232,240,0.6)] text-[11px]">
                          {trade.entry != null
                            ? `$${trade.entry.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[rgba(226,232,240,0.6)] text-[11px]">
                          {trade.exit != null ? (
                            `$${trade.exit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          ) : (
                            <span className="text-[rgba(226,232,240,0.25)]">
                              —
                            </span>
                          )}
                        </td>
                        {/* PnL cell: colored text + subtle background tint */}
                        <td
                          className="px-3 py-2.5 font-mono font-semibold text-[11px]"
                          style={{
                            color: isWin ? "#39ff14" : "#ff4444",
                            background: isWin
                              ? "rgba(57,255,20,0.06)"
                              : "rgba(255,68,68,0.06)",
                          }}
                        >
                          {trade.pnl != null ? formatPnl(trade.pnl, true) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[11px]">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              color: "rgba(0,217,255,0.75)",
                              background: "rgba(0,217,255,0.08)",
                              border: "1px solid rgba(0,217,255,0.15)",
                            }}
                          >
                            {formatStrategy(trade.strategy)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div
              className="md:hidden divide-y"
              style={{ borderColor: "rgba(255,255,255,0.04)" }}
            >
              {paginated.map((trade, i) => {
                const isWin = (trade.pnl ?? 0) > 0;
                const rowNum = (page - 1) * PAGE_SIZE + i + 1;
                const { base, quote } = splitSymbol(trade.symbol);
                return (
                  <div
                    key={`mob-${trade.symbol}-${trade.timestamp}-${i}`}
                    data-ocid={`trades.item.${rowNum}`}
                    className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-4 py-3"
                    style={{ borderColor: "rgba(255,255,255,0.04)" }}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#e2e8f0] text-xs">
                        {base}
                        <span className="text-[rgba(226,232,240,0.3)] font-normal">
                          /{quote}
                        </span>
                      </p>
                      <p className="text-[10px] text-[rgba(226,232,240,0.35)] font-mono mt-0.5">
                        {safeFormatDate(trade.timestamp, "MMM dd, HH:mm") ||
                          "—"}
                      </p>
                      <p
                        className="text-[10px] mt-0.5"
                        style={{ color: "rgba(0,217,255,0.6)" }}
                      >
                        {formatStrategy(trade.strategy)}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-[rgba(226,232,240,0.45)]">
                      {trade.exit != null
                        ? `$${trade.exit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "—"}
                    </span>
                    <span
                      className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        color: isWin ? "#39ff14" : "#ff4444",
                        background: isWin
                          ? "rgba(57,255,20,0.08)"
                          : "rgba(255,68,68,0.08)",
                      }}
                    >
                      {trade.pnl != null ? formatPnl(trade.pnl, true) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div
              className="flex items-center justify-between px-4 py-3 border-t"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              <span className="text-[11px] text-[rgba(226,232,240,0.3)] font-mono">
                {effectiveTotal === 0
                  ? "No trades"
                  : `${rangeStart}–${rangeEnd} of ${effectiveTotal} trades`}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-ocid="trades.pagination_prev"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded border border-[rgba(255,255,255,0.08)] text-[rgba(226,232,240,0.45)] hover:text-[#e2e8f0] hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[11px] text-[rgba(226,232,240,0.4)] font-mono px-2">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  data-ocid="trades.pagination_next"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded border border-[rgba(255,255,255,0.08)] text-[rgba(226,232,240,0.45)] hover:text-[#e2e8f0] hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
