import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static-friendly build: relative base so the app works on GitHub Pages,
// any static host, or opened from a file. Share links use the URL hash
// (HashRouter) so no server rewrites are required.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
  },
});
