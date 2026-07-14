import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: any) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) return 'vendor-react';
          if (id.includes('node_modules/@stellar/stellar-sdk')) return 'vendor-stellar';
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three/fiber')) return 'vendor-three';
          if (id.includes('node_modules/framer-motion')) return 'vendor-motion';
          if (id.includes('node_modules/recharts')) return 'vendor-charts';
        },
      },
    },
  },
})
