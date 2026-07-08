import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/turnos-prioritarios/',
  server: {
    port: 3001,
    proxy: {
      '/turnos-prioritarios/api': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
});
