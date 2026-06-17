import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/fuel-control/',
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    port: 3001,
    proxy: {
      '/fuel-control/api': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
});
