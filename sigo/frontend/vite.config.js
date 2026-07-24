import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/sigo/',
  server: {
    port: 3002,
    proxy: {
      '/sigo/api': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
});
