import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    target: "es2020",
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: {
        main: "index.html",
      },
    },
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
});
