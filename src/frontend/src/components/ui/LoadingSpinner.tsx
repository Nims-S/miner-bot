interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: string;
}

const sizeMap = { sm: 14, md: 20, lg: 36 };

export default function LoadingSpinner({
  size = "md",
  color = "#00d9ff",
}: LoadingSpinnerProps) {
  const px = sizeMap[size];
  return (
    <div
      className="animate-spin rounded-full border-2 border-transparent"
      style={{
        width: px,
        height: px,
        borderTopColor: color,
        borderRightColor: `${color}44`,
      }}
      role="status"
      aria-label="Loading"
    />
  );
}
