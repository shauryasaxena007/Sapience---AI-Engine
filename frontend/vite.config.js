import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the Vite proxy makes the API same-origin, so cookies just work.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false } } },
});
