import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/electis/',
  server: {
    port: 3002,
    proxy: {
      '/electis/api': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
});
