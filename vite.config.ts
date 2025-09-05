import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: "index.html",
      },
    },
    sourcemap: true,
    target: "es2020",
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "@chnicoloso/lit-jsx",
  },
  resolve: {
    extensions: [".ts", ".js", ".tsx", ".jsx"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  root: ".",
  server: {
    open: true,
    port: 3000,
  },
});
