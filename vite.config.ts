import { defineConfig } from "vite";

// Keep config small and focused; split heavy deps to improve caching
export default defineConfig(({ mode }) => ({
  root: ".",
  build: {
    target: "es2020",
    outDir: "dist",
    // Disable sourcemaps in non-dev builds to reduce output size
    sourcemap: mode === "development",
    rollupOptions: {
      input: {
        main: "index.html",
      },
      output: {
        // Vendor chunking to avoid a single mega-chunk
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("phaser3-rex-plugins")) return "rex";
          if (id.includes("phaser")) return "phaser";
          // Collapse all non-Phaser vendor deps into one chunk to reduce requests
          return "vendor";
        },
      },
    },
    // Keep warning limit modest; rely on better chunking rather than silencing
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    extensions: [".ts", ".js", ".tsx", ".jsx"],
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "@chnicoloso/lit-jsx",
  },
}));
