import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { BarChart2, Layers, LayoutDashboard } from "lucide-react";
import React, { Suspense } from "react";
import { Toaster } from "sonner";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import EndpointStatusOverlay from "../debug/EndpointStatusOverlay";
import LoadingSpinner from "../ui/LoadingSpinner";

const Dashboard = React.lazy(() => import("../../pages/Dashboard"));
const Trades = React.lazy(() => import("../../pages/Trades"));
const Assets = React.lazy(() => import("../../pages/Assets"));

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { to: "/trades", label: "Trades", icon: <BarChart2 size={16} /> },
  { to: "/assets", label: "Assets", icon: <Layers size={16} /> },
];

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] gap-3">
      <LoadingSpinner size="lg" />
    </div>
  );
}

function RootLayout() {
  useAutoRefresh();
  return (
    <>
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background: "rgba(15,20,27,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#e2e8f0",
            backdropFilter: "blur(12px)",
          },
        }}
      />
      <div className="min-h-screen bg-[#0b0f14] flex">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-[240px] z-30 bg-[#0d1117] border-r border-[rgba(255,255,255,0.06)]">
          <div className="h-[56px] flex items-center px-5 border-b border-[rgba(255,255,255,0.06)]">
            <span className="text-[#00d9ff] font-bold text-lg tracking-tight flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <span>Miner Bot</span>
            </span>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                data-ocid={`nav.${item.label.toLowerCase()}.link`}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-smooth relative"
                activeProps={{
                  className: "text-[#00d9ff] bg-[rgba(0,217,255,0.08)]",
                }}
                inactiveProps={{
                  className:
                    "text-[rgba(226,232,240,0.55)] hover:text-[#e2e8f0] hover:bg-[rgba(255,255,255,0.05)]",
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="px-5 py-4 border-t border-[rgba(255,255,255,0.06)]">
            <p className="text-xs text-[rgba(226,232,240,0.3)] font-mono">
              v1.0
            </p>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 lg:ml-[240px] mb-16 lg:mb-0 flex flex-col min-h-screen">
          <Outlet />
        </div>

        {/* Bottom nav — mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-[#0d1117] border-t border-[rgba(255,255,255,0.06)] flex items-center">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              data-ocid={`bottom_nav.${item.label.toLowerCase()}.link`}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-smooth"
              activeProps={{ className: "text-[#00d9ff]" }}
              inactiveProps={{ className: "text-[rgba(226,232,240,0.45)]" }}
            >
              <span className="flex items-center justify-center">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Debug overlay — all pages */}
        <EndpointStatusOverlay />
      </div>
    </>
  );
}

// Route tree
const rootRoute = createRootRoute({ component: RootLayout });

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <Dashboard />
    </Suspense>
  ),
});

const tradesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/trades",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <Trades />
    </Suspense>
  ),
});

const assetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/assets",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <Assets />
    </Suspense>
  ),
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  tradesRoute,
  assetsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function AppLayout() {
  return <RouterProvider router={router} />;
}
