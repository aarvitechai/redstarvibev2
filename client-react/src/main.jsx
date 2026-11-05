import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ThemeProvider from './context/ThemeProvider.jsx'

// StrictMode is DEVELOPMENT-only. It renders components twice and runs effects mount -> unmount -> mount,
// so impure renders and missing effect cleanups show up early. It adds nothing to the production build.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
