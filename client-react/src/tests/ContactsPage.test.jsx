import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContactsPage from '../pages/ContactsPage';
import { fail, mockFetch, ok } from './fetchMock';

const seed = [
  { id: 1, name: 'Asha Verma', email: 'asha@example.com', phone: '+91 98765 43210', isFavourite: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 2, name: 'Ravi Kumar', email: 'ravi@example.com', phone: null, isFavourite: false, createdAt: '2026-01-01T00:00:00Z' },
];

// A tiny fake API: answers by method + path, the way the real controller does
function fakeApi({ createDelay = 50, createResult } = {}) {
  return mockFetch((url, { method, body }) => {
    const path = new URL(url).pathname;
    if (method === 'GET' && path === '/api/contacts') return ok(seed);
    if (method === 'POST' && path === '/api/contacts') {
      const input = JSON.parse(body);
      return { ...(createResult ?? ok({ ...input, id: 3, createdAt: '2026-01-02T00:00:00Z' })), delayMs: createDelay };
    }
    if (method === 'PUT' && path === '/api/contacts/2/favourite') return ok({ ...seed[1], isFavourite: JSON.parse(body).isFavourite });
    if (method === 'PUT' && path === '/api/contacts/2') return ok({ ...seed[1], ...JSON.parse(body) });
    if (method === 'DELETE' && path === '/api/contacts/2') return { status: 204 };
    return fail(404, 'not mocked');
  });
}

const names = () => within(screen.getByRole('list', { name: 'Contacts' })).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'));

async function addViaActions(user, name, email) {
  const form = screen.getByRole('form', { name: 'Add contact (actions)' });
  await user.type(within(form).getByLabelText('Name'), name);
  await user.type(within(form).getByLabelText('Email'), email);
  await user.click(within(form).getByRole('button', { name: 'Add contact' }));
  return form;
}

afterEach(() => vi.unstubAllGlobals());

describe('ContactsPage', () => {
  it('loads contacts from the API, favourites first', async () => {
    fakeApi();
    render(<ContactsPage />);
    expect(screen.getByText('Loading contacts…')).toBeInTheDocument();
    await waitFor(() => expect(names()).toEqual(['Asha Verma', 'Ravi Kumar']));
  });

  it('useOptimistic: the new contact appears IMMEDIATELY as "Saving…", then becomes real', async () => {
    const user = userEvent.setup();
    fakeApi({ createDelay: 100 });
    render(<ContactsPage />);
    await waitFor(() => expect(names()).toHaveLength(2));

    await addViaActions(user, 'Neha Patel', 'neha@example.com');

    const pending = await screen.findByRole('listitem', { name: 'Neha Patel' });
    expect(pending).toHaveAttribute('aria-busy', 'true'); // shown before the server answered
    expect(within(pending).getByText('Saving…')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('listitem', { name: 'Neha Patel' })).not.toHaveAttribute('aria-busy'));
    expect(names()).toEqual(['Asha Verma', 'Neha Patel', 'Ravi Kumar']);
  });

  it('useOptimistic ROLLS BACK when the server rejects, and the error lands on the field', async () => {
    const user = userEvent.setup();
    fakeApi({ createResult: { status: 409, body: { success: false, data: null, errors: ['dup'], fieldErrors: { email: ['Email is already in use.'] } } } });
    render(<ContactsPage />);
    await waitFor(() => expect(names()).toHaveLength(2));

    const form = await addViaActions(user, 'Copy Cat', 'asha@example.com');

    expect(await screen.findByRole('listitem', { name: 'Copy Cat' })).toBeInTheDocument(); // optimistic
    expect(await within(form).findByText('Email is already in use.')).toBeInTheDocument();
    expect(names()).toEqual(['Asha Verma', 'Ravi Kumar']); // the fake row is gone
  });

  it('classic mode waits for the server (no optimistic row)', async () => {
    const user = userEvent.setup();
    fakeApi({ createDelay: 50 });
    render(<ContactsPage />);
    await waitFor(() => expect(names()).toHaveLength(2));

    await user.click(screen.getByLabelText('onSubmit + useState'));
    const form = screen.getByRole('form', { name: 'Add contact (classic)' });
    await user.type(within(form).getByLabelText('Name'), 'Neha Patel');
    await user.type(within(form).getByLabelText('Email'), 'neha@example.com');
    await user.click(within(form).getByRole('button', { name: 'Add contact' }));

    expect(screen.queryByRole('listitem', { name: 'Neha Patel' })).not.toBeInTheDocument();
    expect(await screen.findByRole('listitem', { name: 'Neha Patel' })).toBeInTheDocument();
  });

  it('favourite, edit and two-step delete', async () => {
    const user = userEvent.setup();
    fakeApi();
    render(<ContactsPage />);
    await waitFor(() => expect(names()).toHaveLength(2));

    await user.click(screen.getByRole('switch', { name: 'Favourite Ravi Kumar' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Favourite Ravi Kumar' })).toHaveAttribute('aria-checked', 'true'));

    await user.click(within(screen.getByRole('listitem', { name: 'Ravi Kumar' })).getByRole('button', { name: 'Edit' }));
    const edit = screen.getByRole('form', { name: 'Edit Ravi Kumar' });
    await user.clear(within(edit).getByLabelText('Name'));
    await user.type(within(edit).getByLabelText('Name'), 'Ravi K');
    await user.click(within(edit).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('listitem', { name: 'Ravi K' })).toBeInTheDocument();

    const ravi = screen.getByRole('listitem', { name: 'Ravi K' });
    await user.click(within(ravi).getByRole('button', { name: 'Delete' }));
    await user.click(within(ravi).getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(names()).toEqual(['Asha Verma']));
  });
});
