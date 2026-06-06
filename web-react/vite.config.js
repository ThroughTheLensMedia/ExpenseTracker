import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Explicitly forward VITE_SENTRY_DSN from process.env so Vercel's injected
    // env var gets baked into the bundle (Vite doesn't auto-forward process.env
    // into import.meta.env without a .env file entry)
    'import.meta.env.VITE_SENTRY_DSN': JSON.stringify(process.env.VITE_SENTRY_DSN || ''),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // When running local backend
        changeOrigin: true,
      }
    }
  },
  build: {
    // Warn when any individual chunk exceeds 600KB
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — changes almost never; maximum cache hit rate
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase SDK — large, infrequently updated
          'vendor-supabase': ['@supabase/supabase-js'],
          // Chart.js — ~200KB, only needed on Dashboard / Tax pages
          'vendor-charts': ['chart.js'],
        }
      }
    }
  }
})
