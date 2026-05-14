import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/stock-control/',
  server: {
    port: 3000,
    proxy: {
      '/stock-control/api': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
});
