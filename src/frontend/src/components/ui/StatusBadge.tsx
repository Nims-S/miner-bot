type StatusType = "ACTIVE" | "PAUSED" | "IN TRADE" | "IN_TRADE" | string;

interface StatusBadgeProps {
  status: StatusType;
  size?: "sm" | "md";
}

const CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  ACTIVE: {
    label: "ACTIVE",
    color: "#39ff14",
    bg: "rgba(57,255,20,0.08)",
    border: "rgba(57,255,20,0.2)",
    dot: "#39ff14",
  },
  "IN TRADE": {
    label: "IN TRADE",
    color: "#00d9ff",
    bg: "rgba(0,217,255,0.08)",
    border: "rgba(0,217,255,0.2)",
    dot: "#00d9ff",
  },
  IN_TRADE: {
    label: "IN TRADE",
    color: "#00d9ff",
    bg: "rgba(0,217,255,0.08)",
    border: "rgba(0,217,255,0.2)",
    dot: "#00d9ff",
  },
  PAUSED: {
    label: "PAUSED",
    color: "#ff4444",
    bg: "rgba(255,68,68,0.08)",
    border: "rgba(255,68,68,0.2)",
    dot: "#ff4444",
  },
};

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const key = (status ?? "ACTIVE").toUpperCase().replace("-", " ");
  const cfg = CONFIG[key] ?? CONFIG.ACTIVE;

  const sizeClass =
    size === "sm"
      ? "text-[10px] px-1.5 py-0.5 gap-1"
      : "text-[11px] px-2 py-1 gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded font-semibold tracking-wider uppercase ${sizeClass}`}
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span
        className="rounded-full"
        style={{
          width: size === "sm" ? 5 : 6,
          height: size === "sm" ? 5 : 6,
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}
