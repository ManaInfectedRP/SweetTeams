import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    nodePolyfills({
      protocolImports: true,
    }) // Hanterar stream, buffer, process etc. för simple-peer
  ],
  define: {
    global: 'globalThis',
  },
  server: {
    host: true, // Tillåt åtkomst från nätverket
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true
      }
    }
  }
})
