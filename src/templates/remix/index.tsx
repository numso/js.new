import { createRoot } from '@remix-run/dom'

import App from './app'

const el = document.getElementById('app')
createRoot(el).render(<App />)
