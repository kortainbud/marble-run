import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5230, strictPort: true },
  preview: { port: 5230 },
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('@dimforge')) return 'rapier'
          if (id.includes('node_modules/three')) return 'three'
        },
      },
    },
  },
})
