import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    process.env.AppMode !== 'web' && electron({
      main: {
        entry: 'src/electron/bootstrap.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3', 'drizzle-orm'],
            },
          },
        },
      },
      preload: {
        input: 'src/electron/preload.ts',
      },
      // Optional: Use Node.js API in the Renderer process
      renderer: {},
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
