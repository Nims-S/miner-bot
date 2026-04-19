interface SignalBadgeProps {
  signal: unknown;
  size?: "sm" | "md";
}

const CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  LONG: {
    label: "LONG",
    color: "#39ff14",
    bg: "rgba(57,255,20,0.1)",
    border: "rgba(57,255,20,0.25)",
  },
  SHORT: {
    label: "SHORT",
    color: "#ff4444",
    bg: "rgba(255,68,68,0.1)",
    border: "rgba(255,68,68,0.25)",
  },
  NONE: {
    label: "NONE",
    color: "rgba(226,232,240,0.4)",
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.1)",
  },
};

export default function SignalBadge({ signal, size = "md" }: SignalBadgeProps) {
  const key = String(signal ?? "NONE").toUpperCase();
  const cfg = CONFIG[key] ?? CONFIG.NONE;

  const sizeClass =
    size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-1";

  return (
    <span
      className={`inline-flex items-center rounded font-bold tracking-wider font-mono ${sizeClass}`}
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {cfg.label}
    </span>
  );
}
