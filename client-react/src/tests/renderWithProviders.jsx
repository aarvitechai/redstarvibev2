import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../App';
import AuthProvider from '../context/AuthProvider';
import ThemeProvider from '../context/ThemeProvider';
import LocationProbe from './LocationProbe';

// Components that read context need their Provider in tests too. One helper keeps that in one place.
// Phase 9 adds the Redux store here. Log a user in BEFORE rendering with loginAs() (tests/authHelpers.js).
export function renderWithProviders(ui, { route = '/', ...options } = {}) {
  const Wrapper = ({ children }) => (
    // MemoryRouter: a router that keeps its history in memory. Perfect for tests (no real browser URL).
    <MemoryRouter initialEntries={[route]}>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
  return render(ui, { wrapper: Wrapper, ...options });
}

// Render the WHOLE route tree at a URL, the way a user arriving on that link would see it
export function renderApp(route = '/') {
  return renderWithProviders(
    <>
      <AppRoutes />
      <LocationProbe />
    </>,
    { route },
  );
}
