import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

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
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  build: {
    // Warn when any individual chunk exceeds 600KB
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      // home.html = prerendered shell for the "/" route (see vercel.json rewrite)
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        home: resolve(import.meta.dirname, 'home.html'),
      },
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
