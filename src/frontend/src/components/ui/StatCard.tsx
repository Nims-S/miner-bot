interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  valueColor?: "blue" | "green" | "red" | "default";
  className?: string;
}

const valueColorMap: Record<string, string> = {
  blue: "#00d9ff",
  green: "#39ff14",
  red: "#ff4444",
  default: "#e2e8f0",
};

export default function StatCard({
  label,
  value,
  subtitle,
  valueColor = "default",
  className = "",
}: StatCardProps) {
  return (
    <div className={`glass-card px-4 py-3 flex flex-col gap-0.5 ${className}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-[rgba(226,232,240,0.4)]">
        {label}
      </p>
      <p
        className="text-xl font-bold font-tabular leading-tight"
        style={{ color: valueColorMap[valueColor] ?? valueColorMap.default }}
      >
        {value}
      </p>
      {subtitle && (
        <p className="text-[11px] text-[rgba(226,232,240,0.45)] mt-0.5">
          {subtitle}
        </p>
      )}
    </div>
  );
}
