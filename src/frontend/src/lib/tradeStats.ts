import type { TradeRecord } from "../types/trading";

export interface TradeStats {
  wins: number;
  totalTrades: number;
  winRate: number; // percentage 0-100
  totalPnl: number;
  avgWin: number; // positive — average profit on winning trades
  avgLoss: number; // positive — absolute value of average loss
  profitFactor: number;
}

/**
 * Compute trade statistics from a list of TradeRecord entries.
 * Only CLOSED trades with non-null pnl are counted.
 * avgLoss is always returned as a positive number (Math.abs).
 * Callers should display it as "-$X.XX" if needed.
 */
export function calcTradeStats(trades: TradeRecord[]): TradeStats {
  const closed = trades.filter((t) => t.status === "CLOSED" && t.pnl !== null);
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
  const losses = closed.filter((t) => (t.pnl ?? 0) < 0);
  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const winSum = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const lossSum = losses.reduce((s, t) => s + (t.pnl ?? 0), 0); // negative
  const profitFactor =
    lossSum !== 0 ? winSum / Math.abs(lossSum) : winSum > 0 ? 999 : 0;

  return {
    wins: wins.length,
    totalTrades: closed.length,
    winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
    totalPnl,
    avgWin: wins.length > 0 ? winSum / wins.length : 0,
    avgLoss: losses.length > 0 ? Math.abs(lossSum / losses.length) : 0, // always positive
    profitFactor,
  };
}
