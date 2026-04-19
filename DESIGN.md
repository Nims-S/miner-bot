# Design Brief

**Miner Bot** — Professional trading dashboard inspired by UltraTrader. Brutalist trading terminal aesthetic with glassmorphism, high information density, and neon accents for real-time market monitoring and control.

## Tone & Context

Brutalist trading terminal: no decorative filler, maximum clarity, intentional visual hierarchy. The interface facilitates rapid decision-making and status monitoring for crypto traders. Every element serves a functional purpose.

## Palette

| Role | OKLCH L C H | Usage |
|------|-----------|-------|
| Background | 0.08 0 0 | Near-black app background (#0b0f14 equivalent) |
| Card Surface | 0.11 0.01 240 | Glassmorphic card base with subtle blue tint |
| Foreground | 0.93 0 0 | Primary text, high contrast |
| Secondary Text | 0.6 0 0 | Labels, metadata, lower hierarchy |
| Electric Blue | 0.65 0.23 200 | Primary accent, active states, buy signals |
| Neon Green | 0.76 0.24 130 | Success, profit, confirmed actions |
| Loss Red | 0.55 0.22 25 | Destructive, loss, selling, danger |
| Profit Green | 0.63 0.21 140 | Profit PnL, winning trades |
| Border | 0.12 0.01 240 | Subtle dividers, glassmorphic frame (white 5–10% opacity) |

## Typography

| Family | Use | Weight | Size |
|--------|-----|--------|------|
| DM Sans | Display, body, labels | 400–600 | 12–20px |
| JetBrains Mono | Numbers, prices, code | 500 | 12–14px |

Sharp sans-serif for terminal clarity; monospace for price data and real-time values.

## Elevation & Depth

**Card Treatment**: `backdrop-blur-xl`, `bg-card/30`, `border border-white/5`, `rounded-xl`. Light box-shadow for definition without weight.

**Glassmorphism**: Subtle border (1px white 5–10% opacity), soft backdrop blur (20px), surface opacity 30–50% for depth perception.

**Interactive Lift**: Hover transitions smooth 150ms with slight upward translate (-translate-y-1) and shadow-lg for hover feedback.

## Structural Zones

| Zone | Background | Border | Purpose |
|------|-----------|--------|---------|
| Header (sticky) | card/40 glassmorphic | border/20 | Status, live indicator, controls |
| Bot Status Bar | card/30 glassmorphic | border/10 | Version, uptime, connection quality, server time |
| Sidebar Nav (≥1024px) | card/30 | border/10 | Navigation, active=electric-blue |
| Bottom Nav (<768px) | card/40 | border/10 | Mobile navigation, 64px height |
| Content Grid | background | none | Main trading interface area |
| Global Control Panel | card/35 glassmorphic | border/15 | Enable Trading, Emergency Flatten, Kill All toggles |
| Risk Panel | card/30 glassmorphic | border/10 | Capital allocation, deployed/available breakdown, per-asset ratios |
| Stats Row | card/30 glassmorphic | border/10 | Compact metric cards: Realized PnL, Win Rate, Balance, Live PnL |
| Asset Cards | card/30 glassmorphic | border/10 | 3-column grid (desktop), symbol, live prices (Binance), badge, controls |
| Position Bar | card/40 | border/15 | Horizontal SL→Entry→TP1→TP2 with animated price dot |
| Trades Table | card/25 | border/5 | Live /trades endpoint: symbol, entry, exit, PnL, timestamp, regime |
| Charts | card/25 | border/5 | Dark Recharts background with colored lines |
| Control Panel | card/35 glassmorphic | border/15 | Kill switches, emergency flatten, danger button |

## Component Patterns

**Asset Card**: Compact header (symbol, regime badge), prices grid (entry, TP1, TP2, SL, current), control toggles, colored status indicator (profit=green, loss=red, no position=muted).

**Position Bar**: Horizontal progress visualization with markers: SL (left), Entry, TP1, TP2 (right), animated dot tracking current price.

**Kill Switch**: Toggle with immediate visual feedback, disabled during request, error toast on failure.

**Metric Card**: Icon + label + value with optional change indicator and secondary text.

**Table Rows**: Dark alternate (card/30 and card/20) for trade history; compact monospace for prices.

## Motion

- **Live Status Pulse**: Header indicator animates opacity 2s loop (pulse-live class)
- **Price Tick**: Value update animates opacity 0.5s (price-tick class) on data change
- **Smooth Transitions**: All interactive elements use transition-smooth (0.3s cubic-bezier)
- **Hover Lift**: Cards on hover: shadow-lg, -translate-y-1 (150ms smooth)
- **Neon Glow**: Active toggles and positive PnL values glow with electric-blue shadow (20px blur, 0.3 opacity)

## Responsive

**Desktop (≥1024px)**: 240px sidebar, 3-column asset grid, full header, position bars visible.

**Mobile (<768px)**: Bottom nav (64px), single column, full-width cards, compact stats, swipe-friendly spacing.

## Signature Detail

**Neon glow on profit values and active toggles** — electric blue shadow at 0.3 opacity creates the UltraTrader premium feel without overwhelming the interface. This single detail elevates the terminal from functional to distinctive.

## New Features (V11+)

**Bot Status Bar**: Live server connection indicator, version, uptime, server time. Styled as glass-card with status-dot (green=online, red=offline) and pulsing animation.

**Risk Panel**: Capital allocation breakdown showing total_capital, deployed_capital, available_capital, and per-asset ratios via horizontal allocation bars. Uses stat-card pattern with electric-blue values.

**Live Price Integration**: All asset cards fetch current prices from Binance API; prices update every 3 seconds. Prices also displayed on asset detail page with 24h change badge.

**Live Trades**: /trades endpoint connected to table, charts, and stats. No sample data — real trades appear as they close on the bot.
