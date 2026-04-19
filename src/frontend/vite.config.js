import { fileURLToPath, URL } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Stub path — redirects all IC/ICP SDK imports to a no-op module so that
// @icp-sdk/core's TypeScript Worker and wasm blobs never load in the browser.
const icStub = fileURLToPath(new URL("./src/lib/ic-stub.js", import.meta.url));

export default defineConfig({
  logLevel: "error",
  build: {
    emptyOutDir: true,
    sourcemap: false,
    minify: true,
  },
  css: {
    postcss: "./postcss.config.js",
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4943",
        changeOrigin: true,
      },
      "/binance-api": {
        target: "https://api.binance.com/api/v3",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/binance-api/, ""),
      },
    },
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
      // Stub out all @icp-sdk/core subpaths to prevent Worker/wasm from loading
      { find: /^@icp-sdk\/core(.*)$/, replacement: icStub },
      // Stub out all @dfinity/* packages
      { find: /^@dfinity\/(.*)$/, replacement: icStub },
    ],
  },
});
