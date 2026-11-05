import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from './renderWithProviders';

describe('Layout (a layout route with <Outlet />)', () => {
  it('renders header and footer around the matched page', async () => {
    renderApp('/playground');

    expect(screen.getByRole('banner')).toHaveTextContent('RedStarVibe'); // <header>
    expect(screen.getByRole('contentinfo')).toHaveTextContent(`© ${new Date().getFullYear()} RedStarVibe`); // <footer>
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1, name: 'Playground' }));
  });

  it('the brand links home', () => {
    renderApp('/playground');
    expect(screen.getByRole('link', { name: 'RedStarVibe' })).toHaveAttribute('href', '/');
  });
});
