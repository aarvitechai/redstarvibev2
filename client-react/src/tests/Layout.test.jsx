import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Layout from '../components/layout/Layout';

describe('Layout', () => {
  it('renders header, footer and whatever is passed as children', () => {
    render(
      <Layout appName="TestApp">
        <p>Page content</p>
      </Layout>,
    );

    expect(screen.getByRole('banner')).toHaveTextContent('TestApp'); // <header>
    expect(screen.getByRole('contentinfo')).toHaveTextContent(`© ${new Date().getFullYear()} TestApp`); // <footer>
    expect(screen.getByRole('main')).toContainElement(screen.getByText('Page content'));
  });

  it('uses a default appName when none is passed', () => {
    render(<Layout />);
    expect(screen.getByRole('banner')).toHaveTextContent('RedStarVibe');
  });
});
