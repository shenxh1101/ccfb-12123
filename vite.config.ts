import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/jszip') || id.includes('node_modules/fflate')) return 'zip';
          return undefined;
        },
      },
    },
  },
  server: { port: 4173, strictPort: true },
});
