import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import 'monaco-editor/dev/vs/style.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import './lib/ag-grid/registerAgGrid'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
