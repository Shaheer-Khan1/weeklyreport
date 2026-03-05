import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/login': 'http://localhost:8001',
      '/auth':  'http://localhost:8001',
      '/transcribe': 'http://localhost:8001',
      '/generate-email': 'http://localhost:8001',
      '/send-email': 'http://localhost:8001',
    },
  },
})
