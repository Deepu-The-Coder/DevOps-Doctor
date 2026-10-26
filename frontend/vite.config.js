import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Keep the browser's Host header so OAuth redirects come back to this origin.
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: false, xfwd: true } },
  },
});
