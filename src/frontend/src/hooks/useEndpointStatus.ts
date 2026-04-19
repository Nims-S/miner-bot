import { useCallback, useEffect, useRef, useState } from "react";

const BASE_URL = "https://crypto-trader-ver-6-alpha.onrender.com";
const PING_INTERVAL = 10_000; // 10 s
const PING_TIMEOUT = 5_000; // 5 s

export type EndpointState = "pending" | "ok" | "error";

export interface EndpointStatus {
  path: string;
  url: string;
  state: EndpointState;
  latencyMs: number | null;
  lastCheckedAt: number | null; // epoch ms
}

const ENDPOINTS: Array<{ path: string; url: string }> = [
  { path: "/health", url: `${BASE_URL}/health` },
  { path: "/api/v2/overview", url: `${BASE_URL}/api/v2/overview` },
  { path: "/api/v2/controls", url: `${BASE_URL}/api/v2/controls` },
  { path: "/api/v2/positions", url: `${BASE_URL}/api/v2/positions?limit=1` },
  { path: "/api/v2/trades", url: `${BASE_URL}/api/v2/trades?page=1&limit=1` },
];

function buildInitial(): EndpointStatus[] {
  return ENDPOINTS.map((ep) => ({
    ...ep,
    state: "pending",
    latencyMs: null,
    lastCheckedAt: null,
  }));
}

export function useEndpointStatus() {
  const [statuses, setStatuses] = useState<EndpointStatus[]>(buildInitial);
  const mounted = useRef(true);

  const pingAll = useCallback(async () => {
    const results = await Promise.allSettled(
      ENDPOINTS.map(async (ep) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PING_TIMEOUT);
        const t0 = performance.now();
        try {
          const res = await fetch(ep.url, {
            method: "GET",
            mode: "cors",
            cache: "no-store",
            credentials: "omit",
            signal: controller.signal,
          });
          const latencyMs = Math.round(performance.now() - t0);
          return {
            path: ep.path,
            state: res.ok ? ("ok" as const) : ("error" as const),
            latencyMs,
            lastCheckedAt: Date.now(),
          };
        } catch {
          const latencyMs = Math.round(performance.now() - t0);
          return {
            path: ep.path,
            state: "error" as const,
            latencyMs,
            lastCheckedAt: Date.now(),
          };
        } finally {
          clearTimeout(timer);
        }
      }),
    );

    if (!mounted.current) return;

    setStatuses((prev) =>
      prev.map((ep, i) => {
        const r = results[i];
        if (r.status === "fulfilled") {
          return { ...ep, ...r.value };
        }
        return { ...ep, state: "error", lastCheckedAt: Date.now() };
      }),
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    pingAll();
    const timer = setInterval(pingAll, PING_INTERVAL);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [pingAll]);

  return statuses;
}
