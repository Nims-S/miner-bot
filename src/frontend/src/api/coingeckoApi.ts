/**
 * CoinGecko API — DISABLED.
 *
 * CoinGecko blocks browser requests from external domains via CORS.
 * All prices now come from backend API responses instead.
 * This stub exists to satisfy any remaining imports without build errors.
 */

export async function fetchPricesFromCoinGecko(): Promise<Record<
  string,
  number
> | null> {
  // Intentionally no-op — browser → CoinGecko is CORS-blocked.
  return {};
}
