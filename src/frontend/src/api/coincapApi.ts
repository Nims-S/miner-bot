/**
 * CoinCap API — DISABLED.
 *
 * CoinCap blocks browser requests from external domains via CORS.
 * All prices now come from backend API responses instead.
 * This stub exists to satisfy any remaining imports without build errors.
 */

export async function fetchPricesFromCoinCap(): Promise<Record<
  string,
  number
> | null> {
  // Intentionally no-op — browser → CoinCap is CORS-blocked.
  return null;
}
