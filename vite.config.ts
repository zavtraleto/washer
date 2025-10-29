import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/washer/',
  plugins: [react()],
  resolve: {
    alias: {
      '@app': '/src/app',
      '@game': '/src/game',
    },
  },
});
