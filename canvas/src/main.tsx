import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { installPwaRuntime } from '@/lib/pwa/runtime'

if (import.meta.env.PROD) {
  installPwaRuntime()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
