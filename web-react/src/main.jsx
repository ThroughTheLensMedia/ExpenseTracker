import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import './index.css'
import { ModalProvider } from './components/ModalContext.jsx'

Sentry.init({
  // DSN is a public key — safe to hardcode. Env var approach unreliable with
  // legacy vercel.json builds config + @vercel/static-build.
  dsn: import.meta.env.VITE_SENTRY_DSN || 'https://70d0432f81cd0a376b0430616469c8c9@o4511515662680064.ingest.us.sentry.io/4511516393406464',
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  sendDefaultPii: true,
  // Only send errors in production — avoids noise during local dev
  enabled: import.meta.env.PROD,
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ModalProvider>
      <App />
    </ModalProvider>
  </React.StrictMode>,
)
