/**
 * binanceApi.ts — Binance is no longer used as a price source.
 *
 * This module is retained as an empty stub so that any accidental import
 * does not break the build. All price fetching is handled by
 * coingeckoApi.ts → coincapApi.ts via priceChain.ts.
 */

// Retained for backward-compat symbol exports that other modules may reference
export const _PRICE_INTERVAL_MS = 15000;

/**
 * Returns the canonical display key for a given symbol string.
 * "BTC" → "BTC/USDT", "BTCUSDT" → "BTC/USDT"
 */
const SYMBOL_MAP: Record<string, string> = {
  BTCUSDT: "BTC/USDT",
  ETHUSDT: "ETH/USDT",
  SOLUSDT: "SOL/USDT",
  BNBUSDT: "BNB/USDT",
  XRPUSDT: "XRP/USDT",
};

export function getSymbolKey(symbol: string): string {
  const upper = symbol.toUpperCase().replace("/", "").replace("-", "");
  if (SYMBOL_MAP[upper]) return SYMBOL_MAP[upper];
  const found = Object.entries(SYMBOL_MAP).find(([k]) => k.startsWith(upper));
  return found ? found[1] : symbol;
}
