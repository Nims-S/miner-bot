import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  extractPricesFromOverview,
  extractPricesFromPositions,
  mergePricesAndCache,
} from "../api/priceChain";
import { createTradeStream } from "../api/streamApi";
import type { StreamMessage } from "../api/streamApi";
import {
  fetchControls,
  fetchOverview,
  fetchPositions,
  fetchStatus,
  fetchTrades,
  probeBackend,
} from "../api/traderApi";
import { useTradingStore } from "../store/tradingStore";
import type { BackendPosition, BackendTrade } from "../types/trading";

const BASE_URL = "https://crypto-trader-ver-6-alpha.onrender.com";
void BASE_URL; // used in streamApi, kept for future use

/** Controls polling: 15s */
const CONTROLS_INTERVAL = 15_000;
/** All data polling: 15s (overview + positions + trades + status) */
const DATA_INTERVAL = 15_000;
/** Recovery probe: 10s when in error state */
const RECOVERY_PROBE_INTERVAL = 10_000;
/** Consecutive failures before showing the error banner */
const ERROR_TOAST_THRESHOLD = 5;

export function useAutoRefresh() {
  const actionsRef = useRef({
    setControls: useTradingStore.getState().setControls,
    setBinancePrices: useTradingStore.getState().setBinancePrices,
    setConnectionStatus: useTradingStore.getState().setConnectionStatus,
    setLastUpdated: useTradingStore.getState().setLastUpdated,
    setLoading: useTradingStore.getState().setLoading,
    setError: useTradingStore.getState().setError,
    setRefreshing: useTradingStore.getState().setRefreshing,
    setBackendTrades: useTradingStore.getState().setBackendTrades,
    setBackendPositions: useTradingStore.getState().setBackendPositions,
    setBotStatus: useTradingStore.getState().setBotStatus,
    setOverviewData: useTradingStore.getState().setOverviewData,
    setStreamStatus: useTradingStore.getState().setStreamStatus,
  });

  actionsRef.current = {
    setControls: useTradingStore.getState().setControls,
    setBinancePrices: useTradingStore.getState().setBinancePrices,
    setConnectionStatus: useTradingStore.getState().setConnectionStatus,
    setLastUpdated: useTradingStore.getState().setLastUpdated,
    setLoading: useTradingStore.getState().setLoading,
    setError: useTradingStore.getState().setError,
    setRefreshing: useTradingStore.getState().setRefreshing,
    setBackendTrades: useTradingStore.getState().setBackendTrades,
    setBackendPositions: useTradingStore.getState().setBackendPositions,
    setBotStatus: useTradingStore.getState().setBotStatus,
    setOverviewData: useTradingStore.getState().setOverviewData,
    setStreamStatus: useTradingStore.getState().setStreamStatus,
  };

  const controlsErrorCount = useRef(0);
  const dataErrorCount = useRef(0);
  const mounted = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;

    // ── Helper: update prices from any backend data ───────────────────────────
    function applyPrices(
      overviewRaw: Record<string, unknown> | null,
      positions: BackendPosition[],
    ) {
      const fromOverview = overviewRaw
        ? extractPricesFromOverview(overviewRaw)
        : {};
      const fromPositions = extractPricesFromPositions(positions);
      const merged = mergePricesAndCache(fromOverview, fromPositions);
      if (Object.keys(merged).length > 0) {
        actionsRef.current.setBinancePrices(merged, "backend");
      }
    }

    // ── Controls loop: /api/v2/controls (every 15s) ───────────────────────────
    async function pollControls() {
      const [result] = await Promise.allSettled([fetchControls()]);
      if (!mounted.current) return;

      if (result.status === "fulfilled") {
        actionsRef.current.setControls(result.value);
        actionsRef.current.setError(null);
        actionsRef.current.setConnectionStatus("connected");
        actionsRef.current.setLastUpdated(Date.now());
        controlsErrorCount.current = 0;

        actionsRef.current.setRefreshing(true);
        refreshTimerRef.current = setTimeout(() => {
          if (mounted.current) actionsRef.current.setRefreshing(false);
        }, 600);
      } else {
        controlsErrorCount.current += 1;
        const msg =
          result.reason instanceof Error
            ? result.reason.message
            : "Failed to fetch controls";
        actionsRef.current.setError(msg);

        if (controlsErrorCount.current >= ERROR_TOAST_THRESHOLD) {
          actionsRef.current.setConnectionStatus("error");
          if (controlsErrorCount.current === ERROR_TOAST_THRESHOLD) {
            toast.error("Connection issue", {
              description: "Unable to reach the trading bot. Retrying...",
              id: "state-error",
            });
          }
        } else {
          actionsRef.current.setConnectionStatus("disconnected");
        }
      }
    }

    // ── Data loop: overview + positions + trades + status (every 15s) ─────────
    // This is also where prices are derived — no separate CoinGecko/CoinCap call.
    async function pollData() {
      const [overviewRes, positionsRes, tradesRes, statusRes] =
        await Promise.allSettled([
          fetchOverview(),
          fetchPositions(),
          fetchTrades(),
          fetchStatus(),
        ]);

      if (!mounted.current) return;

      let overviewRaw: Record<string, unknown> | null = null;
      let positions: BackendPosition[] = [];

      if (overviewRes.status === "fulfilled" && overviewRes.value) {
        const ov = overviewRes.value;
        actionsRef.current.setOverviewData(ov);
        // Cast to raw so extractPricesFromOverview can read the assets map
        overviewRaw = ov as unknown as Record<string, unknown>;
        dataErrorCount.current = 0;
      } else if (overviewRes.status === "rejected") {
        dataErrorCount.current += 1;
        console.warn(
          "[useAutoRefresh] fetchOverview failed:",
          overviewRes.reason,
        );
      }

      if (positionsRes.status === "fulfilled") {
        positions = positionsRes.value;
        actionsRef.current.setBackendPositions(positions);
      } else {
        console.warn(
          "[useAutoRefresh] fetchPositions failed:",
          positionsRes.reason,
        );
      }

      // ── Extract prices from backend responses ──────────────────────────────
      applyPrices(overviewRaw, positions);

      if (tradesRes.status === "fulfilled") {
        actionsRef.current.setBackendTrades(
          tradesRes.value.data,
          tradesRes.value.total,
        );
      } else {
        console.warn("[useAutoRefresh] fetchTrades failed:", tradesRes.reason);
      }

      if (statusRes.status === "fulfilled" && statusRes.value) {
        actionsRef.current.setBotStatus(statusRes.value);
      } else if (statusRes.status === "rejected") {
        console.warn("[useAutoRefresh] fetchStatus failed:", statusRes.reason);
      }

      if (dataErrorCount.current >= ERROR_TOAST_THRESHOLD) {
        toast.warning("Data feed issue", {
          description: "Some data may be stale. Retrying…",
          id: "data-error",
        });
      }
    }

    // ── Initial fetch on mount ─────────────────────────────────────────────────
    actionsRef.current.setLoading(true);
    Promise.allSettled([pollControls(), pollData()]).finally(() => {
      if (mounted.current) actionsRef.current.setLoading(false);
    });

    const controlsTimer = setInterval(pollControls, CONTROLS_INTERVAL);
    const dataTimer = setInterval(pollData, DATA_INTERVAL);

    // ── Recovery probe: ping /health when in error state ─────────────────────
    const recoveryTimer = setInterval(async () => {
      if (!mounted.current) return;
      const currentStatus = useTradingStore.getState().connectionStatus;
      if (currentStatus !== "error") return;
      const alive = await probeBackend();
      if (alive && mounted.current) {
        controlsErrorCount.current = 0;
        dataErrorCount.current = 0;
        actionsRef.current.setConnectionStatus("connected");
      }
    }, RECOVERY_PROBE_INTERVAL);

    // ── Real-time stream: PRIMARY live data source ────────────────────────────
    // Stream fires callbacks for every event; polling loop is the fallback.
    const closeStream = createTradeStream({
      onConnect() {
        if (!mounted.current) return;
        actionsRef.current.setStreamStatus("streaming");
      },
      onDisconnect() {
        if (!mounted.current) return;
        actionsRef.current.setStreamStatus("polling");
      },
      onStatusChange(status) {
        if (!mounted.current) return;
        actionsRef.current.setStreamStatus(
          status === "connected" ? "streaming" : "polling",
        );
      },
      onMessage(msg: StreamMessage) {
        if (!mounted.current) return;

        // ── Controls ─────────────────────────────────────────────────────────
        if (Array.isArray(msg.controls)) {
          actionsRef.current.setControls(
            msg.controls as Parameters<
              typeof actionsRef.current.setControls
            >[0],
          );
        }

        // ── Positions ────────────────────────────────────────────────────────
        if (Array.isArray(msg.positions)) {
          const positions = msg.positions as BackendPosition[];
          actionsRef.current.setBackendPositions(positions);
          // Extract prices from stream positions immediately
          const fromPositions = extractPricesFromPositions(positions);
          if (Object.keys(fromPositions).length > 0) {
            actionsRef.current.setBinancePrices(
              mergePricesAndCache({}, fromPositions),
              "backend",
            );
          }
        }

        // ── Trades ───────────────────────────────────────────────────────────
        if (Array.isArray(msg.trades)) {
          actionsRef.current.setBackendTrades(msg.trades as BackendTrade[]);
        }

        // ── Overview / state (assets map with prices) ─────────────────────
        // The backend may push the full state blob via stream
        const overviewPayload = msg.overview ?? (msg.assets ? msg : null);

        if (overviewPayload) {
          const raw = overviewPayload as Record<string, unknown>;
          const ovData = {
            daily_pnl: Number(raw.daily_pnl ?? 0),
            equity: Number(raw.equity ?? 0),
            open_positions: Number(raw.open_positions ?? 0),
            total_pnl: Number(raw.total_pnl ?? 0),
            assets: raw.assets as
              | Record<string, import("../types/trading").AssetData>
              | undefined,
            last_update:
              typeof raw.last_update === "string" ? raw.last_update : undefined,
          };
          actionsRef.current.setOverviewData(ovData);

          // Extract prices from stream state immediately
          const fromOverview = extractPricesFromOverview(raw);
          if (Object.keys(fromOverview).length > 0) {
            const positions = useTradingStore.getState().backendPositions;
            actionsRef.current.setBinancePrices(
              mergePricesAndCache(
                fromOverview,
                extractPricesFromPositions(positions),
              ),
              "backend",
            );
          }
        }
      },
    });

    return () => {
      mounted.current = false;
      if (refreshTimerRef.current !== null)
        clearTimeout(refreshTimerRef.current);
      clearInterval(controlsTimer);
      clearInterval(dataTimer);
      clearInterval(recoveryTimer);
      closeStream();
    };
  }, []); // Empty deps — runs once, never restarts due to store updates
}
