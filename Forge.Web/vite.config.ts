/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// The app calls /api/*; in dev Vite forwards it to the local API. Ports differ from NextTrain's so both can run at once.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Shown in Settings.
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8')).version) },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        // API_TARGET=https://... points dev at a deployed API instead (no local SQL Server needed).
        target: process.env.API_TARGET ?? 'http://localhost:5212',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'node',
  },
})
