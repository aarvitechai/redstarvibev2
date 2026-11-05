import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter } from 'react-router'
import App from './App.jsx'
import ThemeProvider from './context/ThemeProvider.jsx'

// StrictMode is DEVELOPMENT-only. It renders components twice and runs effects mount -> unmount -> mount,
// so impure renders and missing effect cleanups show up early. It adds nothing to the production build.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* BrowserRouter: real URLs (/products/4) using the History API. The host must serve index.html for every path (SPA fallback). */}
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
