import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tokens.css'
import './index.css'
import App from './App'
import { init as initNeoSteamEmbed } from './lib/neoSteamEmbed'

// T-218 — bootstrap sớm handshake `neo-practice` (no-op tuyệt đối khi standalone, xem
// src/lib/neoSteamEmbed.ts). Gọi trước render để PRACTICE_READY gửi đi sớm nhất có thể.
initNeoSteamEmbed()

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
