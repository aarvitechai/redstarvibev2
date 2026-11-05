import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StudentCard from '../components/students/StudentCard';
import { getInitials } from '../utility/format';

const student = Object.freeze({
  id: 1, name: 'Asha Verma', email: 'asha@example.com', course: 'Computer Science', year: 3, isActive: true,
}); // frozen: if the component tried to change a prop, the test would throw

describe('StudentCard', () => {
  it('renders the data passed in props', () => {
    render(<StudentCard student={student} />);
    const card = screen.getByRole('article', { name: 'Asha Verma' });

    expect(within(card).getByRole('heading', { name: 'Asha Verma' })).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'asha@example.com' })).toHaveAttribute('href', 'mailto:asha@example.com');
    expect(within(card).getByText('Computer Science')).toBeInTheDocument();
    expect(within(card).getByText('AV')).toBeInTheDocument();
    expect(within(card).getByText('Active')).toBeInTheDocument();
  });

  it('shows Inactive when isActive is false', () => {
    render(<StudentCard student={{ ...student, isActive: false }} />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('getInitials takes at most two letters', () => {
    expect(getInitials('asha')).toBe('A');
    expect(getInitials('Asha  Rani Verma')).toBe('AR');
  });
});
