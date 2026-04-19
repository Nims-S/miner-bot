import { Activity } from "lucide-react";
import { useState } from "react";
import {
  type EndpointState,
  useEndpointStatus,
} from "../../hooks/useEndpointStatus";

// ── helpers ──────────────────────────────────────────────────────────────────

function dotColor(state: EndpointState): string {
  if (state === "ok") return "#39ff14";
  if (state === "error") return "#ff4444";
  return "#f5a623"; // pending / yellow
}

function dotAnimation(state: EndpointState): string {
  if (state === "ok") return "pulse-green 2s ease-in-out infinite";
  if (state === "error") return "pulse-red 2s ease-in-out infinite";
  return "pulse-yellow 2s ease-in-out infinite";
}

function timeAgo(ts: number | null): string {
  if (ts === null) return "—";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function EndpointStatusOverlay() {
  const [open, setOpen] = useState(false);
  const statuses = useEndpointStatus();

  const allOk = statuses.every((s) => s.state === "ok");
  const anyError = statuses.some((s) => s.state === "error");
  const fabColor = anyError ? "#ff4444" : allOk ? "#39ff14" : "#f5a623";
  const fabAnim = anyError
    ? "pulse-red 2s ease-in-out infinite"
    : allOk
      ? "pulse-green 2s ease-in-out infinite"
      : "pulse-yellow 2s ease-in-out infinite";

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        data-ocid="debug_overlay.open_modal_button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle endpoint status debug overlay"
        style={{
          position: "fixed",
          bottom: open ? "calc(var(--overlay-h, 240px) + 16px)" : "80px",
          right: "16px",
          zIndex: 9999,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(13,17,23,0.92)",
          border: `1px solid ${fabColor}44`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: `0 0 12px ${fabColor}33`,
          transition: "bottom 0.2s ease, box-shadow 0.2s ease",
        }}
      >
        {/* Activity icon */}
        <Activity size={16} color={fabColor} />
        {/* Small status dot */}
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: fabColor,
            animation: fabAnim,
          }}
        />
      </button>

      {/* Overlay panel */}
      {open && (
        <div
          data-ocid="debug_overlay.dialog"
          style={{
            position: "fixed",
            bottom: 72,
            right: 16,
            zIndex: 9998,
            width: 320,
            background: "rgba(11,15,20,0.96)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 14,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.05) inset",
            overflow: "hidden",
            animation: "fade-in-up 0.18s ease-out both",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px 8px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#00d9ff",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Endpoint Status
            </span>
            <button
              type="button"
              data-ocid="debug_overlay.close_button"
              onClick={() => setOpen(false)}
              aria-label="Close debug overlay"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(226,232,240,0.4)",
                fontSize: 14,
                lineHeight: 1,
                padding: "2px 4px",
              }}
            >
              ✕
            </button>
          </div>

          {/* Rows */}
          <ul style={{ listStyle: "none", margin: 0, padding: "6px 0" }}>
            {statuses.map((ep, i) => (
              <li
                key={ep.path}
                data-ocid={`debug_overlay.endpoint.item.${i + 1}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 14px",
                  borderBottom:
                    i < statuses.length - 1
                      ? "1px solid rgba(255,255,255,0.04)"
                      : "none",
                }}
              >
                {/* Status dot */}
                <span
                  style={{
                    flexShrink: 0,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: dotColor(ep.state),
                    animation: dotAnimation(ep.state),
                    display: "inline-block",
                  }}
                />

                {/* Endpoint path */}
                <span
                  style={{
                    flex: 1,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    fontSize: 11,
                    color:
                      ep.state === "error"
                        ? "#ff6b6b"
                        : ep.state === "ok"
                          ? "rgba(226,232,240,0.85)"
                          : "rgba(226,232,240,0.5)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {ep.path}
                </span>

                {/* Latency */}
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    fontSize: 10,
                    color:
                      ep.latencyMs === null
                        ? "rgba(226,232,240,0.25)"
                        : ep.latencyMs < 300
                          ? "#39ff14"
                          : ep.latencyMs < 1000
                            ? "#f5a623"
                            : "#ff4444",
                    minWidth: 42,
                    textAlign: "right",
                  }}
                >
                  {ep.latencyMs !== null ? `${ep.latencyMs}ms` : "—"}
                </span>

                {/* Last checked */}
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 9,
                    color: "rgba(226,232,240,0.3)",
                    minWidth: 52,
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {timeAgo(ep.lastCheckedAt)}
                </span>
              </li>
            ))}
          </ul>

          {/* Footer */}
          <div
            style={{
              padding: "6px 14px 8px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              fontSize: 9,
              color: "rgba(226,232,240,0.2)",
              fontFamily: "Inter, sans-serif",
              textAlign: "center",
              letterSpacing: "0.06em",
            }}
          >
            pings every 10 s · 5 s timeout
          </div>
        </div>
      )}

      {/* Inline keyframe for yellow pulse — not in global CSS */}
      <style>{`
        @keyframes pulse-yellow {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(245,166,35,0.6); }
          50%       { opacity: 0.8; box-shadow: 0 0 0 5px rgba(245,166,35,0); }
        }
      `}</style>
    </>
  );
}
