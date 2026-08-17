import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RepositoryProvider } from '@/app/RepositoryProvider'
import { App } from '@/ui/App'
// Order matters: fonts and tokens define what the rest consumes.
import '@/styles/fonts.css'
import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/app.css'

const container = document.getElementById('root')
if (container === null) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <RepositoryProvider>
      <App />
    </RepositoryProvider>
  </StrictMode>,
)
