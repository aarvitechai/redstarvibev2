// Adds DOM matchers such as toBeInTheDocument() and toHaveTextContent()
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { saveSession } from '../services/session';

afterEach(() => {
  cleanup(); // unmount everything between tests
  saveSession(null); // and never leak a login into the next test
  localStorage.clear();
});
