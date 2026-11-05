import { render } from '@testing-library/react';
import ThemeProvider from '../context/ThemeProvider';

// Components that read context need their Provider in tests too. One helper keeps that in one place.
// Phase 7 adds the Router here, and Phase 9 adds the Redux store.
export function renderWithProviders(ui, options) {
  return render(ui, { wrapper: ThemeProvider, ...options });
}
