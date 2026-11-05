import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import StudentsPage from '../pages/StudentsPage';

// These tests check LIFTED STATE: an action in one sibling (the form or a card) updates the others (stats and list).
const stats = () => screen.getByText(/students ·/).textContent.replace(/\s+/g, ' ');
const card = (name) => screen.getByRole('article', { name });

describe('StudentsPage (lifted state across siblings)', () => {
  it('starts with the seed data', () => {
    render(<StudentsPage />);
    expect(stats()).toBe('4 students · 3 active · 1 inactive');
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });

  it('the form adds a student, and the list AND the stats update', async () => {
    const user = userEvent.setup();
    render(<StudentsPage />);
    const form = screen.getByRole('form', { name: 'Add student' });
    const submit = within(form).getByRole('button', { name: 'Add student' });

    expect(submit).toBeDisabled(); // nothing typed yet
    await user.type(within(form).getByLabelText('Name'), 'Neha Patel');
    await user.type(within(form).getByLabelText('Email'), 'neha@example.com');
    await user.type(within(form).getByLabelText('Course'), 'Civil');
    await user.selectOptions(within(form).getByLabelText('Year'), '2');
    await user.click(submit);

    expect(card('Neha Patel')).toHaveTextContent('Civil');
    expect(stats()).toBe('5 students · 4 active · 1 inactive');
    expect(within(form).getByLabelText('Name')).toHaveValue(''); // the draft was reset
  });

  it('a card toggles a student, and the stats update', async () => {
    const user = userEvent.setup();
    render(<StudentsPage />);

    await user.click(within(card('Meera Shah')).getByRole('button', { name: 'Activate' }));

    expect(within(card('Meera Shah')).getByText('Active')).toBeInTheDocument();
    expect(stats()).toBe('4 students · 4 active · 0 inactive');
  });

  it('a card removes a student', async () => {
    const user = userEvent.setup();
    render(<StudentsPage />);

    await user.click(within(card('Ravi Kumar')).getByRole('button', { name: 'Remove' }));

    expect(screen.queryByRole('article', { name: 'Ravi Kumar' })).not.toBeInTheDocument();
    expect(stats()).toBe('3 students · 2 active · 1 inactive');
  });

  it('"Show active only" is derived from state: it filters without losing data', async () => {
    const user = userEvent.setup();
    render(<StudentsPage />);
    const filter = screen.getByLabelText('Show active only');

    await user.click(filter);
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(stats()).toBe('4 students · 3 active · 1 inactive'); // the full list is still there

    await user.click(filter);
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });
});
