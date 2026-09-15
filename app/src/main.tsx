import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { installGlobalErrorReporter } from './infrastructure/errors/error-reporter'
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
