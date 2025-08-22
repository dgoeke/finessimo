import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: '/finessimo/',
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  resolve: {
    extensions: ['.ts', '.js']
  }
})