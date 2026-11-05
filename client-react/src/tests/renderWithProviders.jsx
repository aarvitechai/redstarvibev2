import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../App';
import SessionWatcher from '../components/auth/SessionWatcher';
import ThemeSync from '../components/layout/ThemeSync';
import { makeStore } from '../store';
import LocationProbe from './LocationProbe';

// Everything a component needs to render: a FRESH Redux store per test, plus the router.
// Log a user in BEFORE rendering with loginAs() (tests/authHelpers.js); the store reads the session when created.
export function renderWithProviders(ui, { route = '/', preloadedState, store = makeStore(preloadedState), ...options } = {}) {
  const Wrapper = ({ children }) => (
    <Provider store={store}>
      {/* MemoryRouter: a router that keeps its history in memory. Perfect for tests (no real browser URL). */}
      <MemoryRouter initialEntries={[route]}>
        <ThemeSync />
        <SessionWatcher />
        {children}
      </MemoryRouter>
    </Provider>
  );
  return { store, ...render(ui, { wrapper: Wrapper, ...options }) };
}

// Render the WHOLE route tree at a URL, the way a user arriving on that link would see it
export function renderApp(route = '/', options = {}) {
  return renderWithProviders(
    <>
      <AppRoutes />
      <LocationProbe />
    </>,
    { route, ...options },
  );
}
