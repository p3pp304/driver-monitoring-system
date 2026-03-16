import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Fondamentale per Docker
    port: 5173,
    watch: {
      usePolling: true, // Serve per vedere le modifiche in tempo reale su Windows
    },
  },
})