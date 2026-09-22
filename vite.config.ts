import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import electron from 'vite-plugin-electron'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              // Keep Knex and its optional dialect drivers in Node's dependency
              // graph. Bundling Knex eagerly emits imports for every dialect,
              // including sqlite3, even when only better-sqlite3 is configured.
              external: [
                'knex',
                'better-sqlite3',
                'pg',
                'mysql2',
                '@libsql/client',
              ],
              output: {
                entryFileNames: 'main.js',
              },
            },
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  server: {
    port: 5173,
    open: false,
  },
})
