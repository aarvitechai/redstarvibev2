import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter } from 'react-router'
import App from './App.jsx'
import AuthProvider from './context/AuthProvider.jsx'
import ThemeProvider from './context/ThemeProvider.jsx'
import { restoreSession } from './services/session.js'

// Restore a saved login BEFORE the first render, so the first API request already carries the token
restoreSession()

// StrictMode is DEVELOPMENT-only. It renders components twice and runs effects mount -> unmount -> mount,
// so impure renders and missing effect cleanups show up early. It adds nothing to the production build.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* BrowserRouter: real URLs (/products/4) using the History API. The host must serve index.html for every path (SPA fallback). */}
    <BrowserRouter>
      <ThemeProvider>
        {/* Inside the router: AuthProvider navigates to /login when the API says 401 */}
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
