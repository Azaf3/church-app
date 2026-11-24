import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import { SessaoProvider } from './lib/sessao'
import App from './App'
import './styles.css'

// Na demo (página única, sem servidor) as rotas ficam só em memória
const Router = import.meta.env.MODE === 'demo' ? MemoryRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <SessaoProvider>
        <App />
      </SessaoProvider>
    </Router>
  </StrictMode>,
)
