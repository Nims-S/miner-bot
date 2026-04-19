import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}

export default function ErrorMessage({
  message,
  onRetry,
  compact = false,
}: ErrorMessageProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-[#ff4444] text-xs">
        <AlertTriangle size={12} />
        <span>{message}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="ml-1 underline hover:no-underline transition-smooth"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      data-ocid="error_state"
      className="glass-card border border-[rgba(255,68,68,0.2)] bg-[rgba(255,68,68,0.05)] p-4 flex items-start gap-3"
    >
      <AlertTriangle
        size={18}
        className="text-[#ff4444] mt-0.5 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#ff4444]">Connection error</p>
        <p className="text-xs text-[rgba(226,232,240,0.5)] mt-1 break-words">
          {message}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          data-ocid="error_state.retry_button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(255,68,68,0.1)] border border-[rgba(255,68,68,0.2)] text-[#ff4444] hover:bg-[rgba(255,68,68,0.18)] transition-smooth flex-shrink-0"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      )}
    </div>
  );
}
