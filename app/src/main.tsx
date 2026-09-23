import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { installGlobalErrorReporter } from './infrastructure/errors/error-reporter'
import { ensureServiceWorker } from './infrastructure/pwa/install'
import { applyTheme, readStoredTheme } from './presentation/theme/theme'
import './index.css'

installGlobalErrorReporter()
// Antes do primeiro render: o tema salvo entra sem piscar o escuro.
applyTheme(readStoredTheme())

const root = document.getElementById('root')
if (!root) {
  throw new Error('Elemento #root não encontrado no index.html.')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Depois do primeiro render: o registro do service worker é o que torna o app
// instalável de verdade (ícone próprio, janela própria, abre direto no /app).
window.addEventListener('load', () => {
  void ensureServiceWorker()
})
