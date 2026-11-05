import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.jsx'
import SessionWatcher from './components/auth/SessionWatcher.jsx'
import ThemeSync from './components/layout/ThemeSync.jsx'
import { restoreSession } from './services/session.js'
import { loadCart, makeStore, persistCart } from './store/index.js'

// Restore a saved login BEFORE the store and the first render, so state.auth and the first request both have it
restoreSession()

// ONE store for the app, with the saved cart preloaded ("cart survives reload")
const store = makeStore({ cart: loadCart() })
persistCart(store)

// StrictMode is DEVELOPMENT-only. It renders components twice and runs effects mount -> unmount -> mount,
// so impure renders and missing effect cleanups show up early. It adds nothing to the production build.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* <Provider> makes the store available to useSelector / useDispatch anywhere below it */}
    <Provider store={store}>
      {/* BrowserRouter: real URLs (/products/4) using the History API. The host must serve index.html for every path (SPA fallback). */}
      <BrowserRouter>
        <ThemeSync />
        <SessionWatcher />
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)
