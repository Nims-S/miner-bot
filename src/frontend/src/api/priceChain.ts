/**
 * Price extraction utilities — backend-only approach.
 *
 * CoinGecko and CoinCap block browser requests via CORS.
 * All prices come from the backend API responses instead:
 *   1. /api/v2/overview  → assets[symbol] fields (PRIMARY, via stream or poll)
 *   2. /api/v2/positions → current_price per position (SECONDARY)
 *   3. Module-level lastKnownPrices cache (TERTIARY — never blank)
 *
 * Multi-key format: { 'BTC/USDT': price, 'BTCUSDT': price, 'BTC': price }
 */

export interface PriceFetchResult {
  prices: Record<string, number> | null;
  source: "backend" | "cached" | null;
}

// ─── Module-level cache ────────────────────────────────────────────────────────
// Merge-only: values are never deleted, only updated with confirmed real prices.

const lastKnownPrices: Record<string, number> = {};

/**
 * Persist new prices into the module cache.
 * Only real (> 0) prices are stored — zeros are ignored.
 */
export function updatePriceCache(fresh: Record<string, number>): void {
  for (const [key, val] of Object.entries(fresh)) {
    if (typeof val === "number" && val > 0) {
      lastKnownPrices[key] = val;
    }
  }
}

/** Return a copy of the module-level price cache, or null if empty. */
export function getCachedPrices(): Record<string, number> | null {
  return Object.keys(lastKnownPrices).length > 0
    ? { ...lastKnownPrices }
    : null;
}

// ─── Key normalisation ────────────────────────────────────────────────────────

function buildMultiKeyMap(
  ticker: string,
  price: number,
): Record<string, number> {
  return {
    [`${ticker}/USDT`]: price,
    [`${ticker}USDT`]: price,
    [ticker]: price,
  };
}

function tickerFromSymbol(symbol: string): string {
  return symbol.replace("/USDT", "").replace("USDT", "").replace("-USDT", "");
}

// ─── Primary: extract from /api/v2/overview ───────────────────────────────────

/**
 * Parse prices from the /api/v2/overview response.
 *
 * The backend returns the full state blob on this endpoint:
 *   { assets: { 'BTC/USDT': { signal: { ... }, price, current_price, ... } }, ... }
 *
 * We look for price values in priority order:
 *   current_price → price → signal.price → (inside position) current_price
 */
export function extractPricesFromOverview(
  overviewData: Record<string, unknown>,
): Record<string, number> {
  const priceMap: Record<string, number> = {};

  const assets = overviewData?.assets;
  if (!assets || typeof assets !== "object" || Array.isArray(assets)) {
    return priceMap;
  }

  const assetsObj = assets as Record<string, unknown>;

  for (const [symbol, rawAsset] of Object.entries(assetsObj)) {
    if (!rawAsset || typeof rawAsset !== "object") continue;
    const asset = rawAsset as Record<string, unknown>;

    const ticker = tickerFromSymbol(symbol);
    if (!ticker) continue;

    // Try every known price field in priority order
    let price: number | null = null;

    const candidates = [
      asset.current_price,
      asset.price,
      (asset.signal as Record<string, unknown> | undefined)?.price,
      (asset.position as Record<string, unknown> | undefined)?.current_price,
    ];

    for (const c of candidates) {
      const n = Number(c);
      if (!Number.isNaN(n) && n > 0) {
        price = n;
        break;
      }
    }

    if (price !== null) {
      Object.assign(priceMap, buildMultiKeyMap(ticker, price));
    }
  }

  return priceMap;
}

// ─── Secondary: extract from /api/v2/positions ────────────────────────────────

/**
 * Parse prices from the /api/v2/positions response array.
 * Each position already has server-calculated current_price.
 */
export function extractPricesFromPositions(
  positions: Array<{ symbol?: string; current_price?: number; price?: number }>,
): Record<string, number> {
  const priceMap: Record<string, number> = {};

  if (!Array.isArray(positions)) return priceMap;

  for (const pos of positions) {
    const symbol = pos?.symbol;
    if (!symbol) continue;

    const ticker = tickerFromSymbol(symbol);
    if (!ticker) continue;

    const price =
      pos.current_price && pos.current_price > 0
        ? pos.current_price
        : pos.price && pos.price > 0
          ? pos.price
          : null;

    if (price !== null) {
      Object.assign(priceMap, buildMultiKeyMap(ticker, price));
    }
  }

  return priceMap;
}

// ─── Merge helper ─────────────────────────────────────────────────────────────

/**
 * Merge price maps from overview + positions, update cache, return merged map.
 * The cache acts as a floor — previously-seen prices are never wiped.
 */
export function mergePricesAndCache(
  fromOverview: Record<string, number>,
  fromPositions: Record<string, number>,
): Record<string, number> {
  const merged = { ...fromOverview, ...fromPositions };

  // Only real prices go into cache
  updatePriceCache(merged);

  // Return merged + any extra symbols already in cache
  return { ...lastKnownPrices, ...merged };
}
