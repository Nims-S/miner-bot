import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BackendPosition,
  BackendTrade,
  BotStatus,
  ConnectionStatus,
  Control,
  OverviewData,
  PriceSource,
  RiskData,
  StreamStatus,
  TradeRecord,
  TraderState,
} from "../types/trading";

interface TradingStore {
  traderState: TraderState | null;
  controls: Control[];
  binancePrices: Record<string, number>;
  tradeHistory: TradeRecord[];
  connectionStatus: ConnectionStatus;
  lastUpdated: number | null;
  lastUpdate: Date | null; // legacy — kept for Dashboard compat
  isLoading: boolean;
  error: string | null;
  isRefreshing: boolean;
  /** Timestamps (epoch ms) of when each symbol's position was first observed open. Not persisted. */
  positionOpenTimes: Record<string, number>;
  /** Live positions from /positions endpoint */
  backendPositions: BackendPosition[];
  /** Closed trade history from /trades endpoint */
  backendTrades: BackendTrade[];
  /** Total closed trades from the backend (pagination total) */
  backendTradesTotal: number;
  /** Risk/capital data from /risk endpoint */
  riskData: RiskData | null;
  /** Bot status from /status endpoint */
  botStatus: BotStatus | null;
  /** Overview summary from /api/v2/overview */
  overviewData: OverviewData | null;
  /** Which price source was used for the most recent price update */
  priceSource: PriceSource;
  /** Whether the real-time stream is connected or falling back to polling */
  streamStatus: StreamStatus;

  setTraderState: (state: TraderState) => void;
  setControls: (controls: Control[]) => void;
  setBinancePrices: (
    prices: Record<string, number>,
    source?: PriceSource,
  ) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setLastUpdated: (ts: number) => void;
  updateControlOptimistic: (
    scope: string,
    enabled: boolean,
    flattenOnDisable?: boolean,
  ) => void;
  rollbackControl: (scope: string, prev: Control) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setRefreshing: (r: boolean) => void;
  addTradeRecord: (trade: TradeRecord) => void;
  setBackendPositions: (positions: BackendPosition[]) => void;
  setBackendTrades: (trades: BackendTrade[], total?: number) => void;
  setRiskData: (data: RiskData) => void;
  setBotStatus: (status: BotStatus) => void;
  setOverviewData: (data: OverviewData) => void;
  setStreamStatus: (status: StreamStatus) => void;
}

function deriveClosedTrades(
  prev: TraderState | null,
  next: TraderState,
  existing: TradeRecord[],
  positionOpenTimes: Record<string, number>,
): { newTrades: TradeRecord[]; updatedOpenTimes: Record<string, number> } {
  const newTrades: TradeRecord[] = [];
  const updatedOpenTimes = { ...positionOpenTimes };

  if (!prev?.assets || !next.assets) return { newTrades, updatedOpenTimes };

  const existingIds = new Set(existing.map((t) => t.id));

  for (const [symbol, asset] of Object.entries(next.assets)) {
    const prevAsset = prev.assets[symbol];

    // Track newly opened positions
    if (
      !prevAsset?.position &&
      asset.position &&
      !(symbol in updatedOpenTimes)
    ) {
      updatedOpenTimes[symbol] = Date.now();
    }

    // Detect closed positions
    if (prevAsset?.position && !asset.position) {
      const pos = prevAsset.position;
      const closePrice =
        next.assets[symbol]?.current_price ?? next.assets[symbol]?.price ?? 0;
      const closedTs = Date.now();
      // Use stored open time if available, otherwise fall back to closedTs (duration = 0, honest)
      const openedTs = updatedOpenTimes[symbol] ?? closedTs;
      const id = `${symbol}-${closedTs}`;

      // Remove tracked open time now that position is closed
      delete updatedOpenTimes[symbol];

      if (!existingIds.has(id)) {
        const dir = pos.direction === "SHORT" ? -1 : 1;
        const pnl =
          pos.entry_price > 0 && pos.size > 0
            ? dir * (closePrice - pos.entry_price) * pos.size
            : 0;
        const pnlPct =
          pos.entry_price > 0
            ? ((dir * (closePrice - pos.entry_price)) / pos.entry_price) * 100
            : 0;
        newTrades.push({
          id,
          symbol,
          direction: pos.direction ?? "LONG",
          entry: pos.entry_price,
          exit: closePrice,
          size: pos.size,
          pnl: Math.round(pnl * 100) / 100,
          pnlPct: Math.round(pnlPct * 100) / 100,
          date: new Date().toISOString(),
          openedAt: openedTs,
          closedAt: new Date().toISOString(),
          duration: closedTs - openedTs,
          isWin: pnl > 0,
          status: "CLOSED",
        });
      }
    }
  }

  return { newTrades, updatedOpenTimes };
}

export const useTradingStore = create<TradingStore>()(
  persist(
    (set, get) => ({
      traderState: null,
      controls: [],
      binancePrices: {},
      tradeHistory: [],
      connectionStatus: "disconnected",
      lastUpdated: null,
      lastUpdate: null,
      isLoading: false,
      error: null,
      isRefreshing: false,
      positionOpenTimes: {},
      backendPositions: [],
      backendTrades: [],
      backendTradesTotal: 0,
      riskData: null,
      botStatus: null,
      overviewData: null,
      priceSource: null,
      streamStatus: "disconnected",

      setTraderState: (state) => {
        const { traderState: prev, tradeHistory, positionOpenTimes } = get();
        const { newTrades, updatedOpenTimes } = deriveClosedTrades(
          prev,
          state,
          tradeHistory,
          positionOpenTimes,
        );
        // IMPORTANT: Do NOT overwrite the controls slice here.
        // Controls are fetched independently via fetchControls() and applied
        // via setControls(). Merging state.controls here races against and
        // could clobber the independently-fetched controls slice.
        set({
          traderState: state,
          lastUpdate: new Date(),
          lastUpdated: Date.now(),
          positionOpenTimes: updatedOpenTimes,
          tradeHistory:
            newTrades.length > 0
              ? [...newTrades, ...tradeHistory].slice(0, 500)
              : tradeHistory,
        });
      },

      setControls: (controls) =>
        set({ controls: Array.isArray(controls) ? controls : [] }),

      // MERGE prices into existing map — never replace entirely.
      // This preserves last-known values for symbols that fail to fetch
      // while still updating symbols that succeed.
      setBinancePrices: (prices, source) => {
        if (!prices || Object.keys(prices).length === 0) return;
        set((s) => ({
          binancePrices: { ...s.binancePrices, ...prices },
          ...(source !== undefined ? { priceSource: source } : {}),
        }));
      },

      setConnectionStatus: (status) => set({ connectionStatus: status }),

      setLastUpdated: (ts) => set({ lastUpdated: ts }),

      updateControlOptimistic: (scope, enabled, flattenOnDisable) => {
        set((s) => ({
          controls: (Array.isArray(s.controls) ? s.controls : []).map((c) =>
            c.scope === scope
              ? {
                  ...c,
                  enabled,
                  ...(flattenOnDisable !== undefined
                    ? { flatten_on_disable: flattenOnDisable }
                    : {}),
                }
              : c,
          ),
        }));
      },

      rollbackControl: (scope, prev) => {
        set((s) => ({
          controls: (Array.isArray(s.controls) ? s.controls : []).map((c) =>
            c.scope === scope ? prev : c,
          ),
        }));
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      setRefreshing: (r) => set({ isRefreshing: r }),

      addTradeRecord: (trade) => {
        set((s) => ({
          tradeHistory: [trade, ...s.tradeHistory].slice(0, 500),
        }));
      },

      setBackendPositions: (positions) => set({ backendPositions: positions }),

      setBackendTrades: (trades, total) =>
        set({
          backendTrades: trades,
          ...(total !== undefined ? { backendTradesTotal: total } : {}),
        }),

      setRiskData: (data) => set({ riskData: data }),

      setBotStatus: (status) => set({ botStatus: status }),

      setOverviewData: (data) => set({ overviewData: data }),

      setStreamStatus: (status) => set({ streamStatus: status }),
    }),
    {
      name: "miner-bot-trade-history",
      // Only persist trade history — state/controls/prices are always live
      partialize: (s) => ({ tradeHistory: s.tradeHistory }),
    },
  ),
);
