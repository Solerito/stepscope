import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@/core': fileURLToPath(new URL('./src/core/index.ts', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
});
