// Adds DOM matchers such as toBeInTheDocument() and toHaveTextContent()
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup()); // unmount everything between tests
