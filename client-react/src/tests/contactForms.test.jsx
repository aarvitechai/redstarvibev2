import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ContactEditForm from '../components/contacts/ContactEditForm';
import ContactFormAction from '../components/contacts/ContactFormAction';
import ContactFormClassic from '../components/contacts/ContactFormClassic';
import { ApiError } from '../services/http';
import { firstErrors, toContactPayload, validateContact } from '../utility/contactValidation';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const duplicateEmail = () =>
  new ApiError('dup', { status: 409, fieldErrors: { email: ["Email 'asha@example.com' is already in use."] } });

describe('contactValidation (the client mirror of the server rules)', () => {
  it('reports each invalid field with the same messages the server uses', () => {
    expect(validateContact({ name: ' ', email: 'nope', phone: 'abc' })).toEqual({
      name: 'Name is required.',
      email: 'Enter a valid email address.',
      phone: 'Phone may contain digits, spaces, + ( ) - and be 7 to 20 characters.',
    });
    expect(validateContact({ name: 'Asha', email: 'a@b.co', phone: '' })).toEqual({});
  });

  it('maps server fieldErrors to their first message, and builds the payload', () => {
    expect(firstErrors({ name: ['first', 'second'] })).toEqual({ name: 'first' });
    expect(toContactPayload({ name: ' A ', email: ' e@x.io ', phone: '  ', isFavourite: undefined })).toEqual({
      name: 'A', email: 'e@x.io', phone: null, isFavourite: false,
    });
  });
});

// The classic and Actions forms must behave the same from the user's point of view, so they share these tests
describe.each([
  ['classic (onSubmit)', ContactFormClassic, 'Add contact (classic)'],
  ['React 19 Actions', ContactFormAction, 'Add contact (actions)'],
])('%s form', (_name, Form, formName) => {
  async function fill(user, { name = 'Neha Patel', email = 'neha@example.com', phone = '' } = {}) {
    const form = screen.getByRole('form', { name: formName });
    if (name) await user.type(within(form).getByLabelText('Name'), name);
    if (email) await user.type(within(form).getByLabelText('Email'), email);
    if (phone) await user.type(within(form).getByLabelText('Phone'), phone);
    return form;
  }

  it('shows client errors, keeps what was typed, and does NOT call the API', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<Form onCreate={onCreate} />);

    const form = await fill(user, { name: 'A', email: 'bad' });
    await user.click(within(form).getByRole('button', { name: 'Add contact' }));

    expect(await within(form).findByText('Name must be 2 to 100 characters.')).toBeInTheDocument();
    expect(within(form).getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(within(form).getByLabelText('Name')).toHaveValue('A'); // not wiped by the form reset
    expect(within(form).getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('shows "Saving…" while pending, sends a clean payload, then clears the form', async () => {
    const user = userEvent.setup();
    const save = deferred();
    const onCreate = vi.fn(() => save.promise);
    render(<Form onCreate={onCreate} />);

    const form = await fill(user, { name: '  Neha Patel ', phone: '+91 99999 11111' });
    await user.click(within(form).getByRole('button', { name: 'Add contact' }));

    expect(await within(form).findByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(onCreate).toHaveBeenCalledWith({ name: 'Neha Patel', email: 'neha@example.com', phone: '+91 99999 11111', isFavourite: false });

    save.resolve();
    expect(await within(form).findByRole('button', { name: 'Add contact' })).toBeEnabled();
    await waitFor(() => expect(within(form).getByLabelText('Name')).toHaveValue(''));
  });

  it('shows the SERVER error under the right field (409 duplicate email)', async () => {
    const user = userEvent.setup();
    render(<Form onCreate={vi.fn().mockRejectedValue(duplicateEmail())} />);

    const form = await fill(user, { email: 'asha@example.com' });
    await user.click(within(form).getByRole('button', { name: 'Add contact' }));

    expect(await within(form).findByText("Email 'asha@example.com' is already in use.")).toBeInTheDocument();
    expect(within(form).getByLabelText('Email')).toHaveValue('asha@example.com');
  });

  it('shows a form-level error when the server sends no field errors', async () => {
    const user = userEvent.setup();
    render(<Form onCreate={vi.fn().mockRejectedValue(new ApiError('Request failed (500)', { status: 500 }))} />);

    const form = await fill(user);
    await user.click(within(form).getByRole('button', { name: 'Add contact' }));

    expect(await within(form).findByText('Request failed (500)')).toBeInTheDocument();
  });
});

describe('ContactEditForm (react-hook-form + Controller)', () => {
  const contact = { id: 2, name: 'Ravi Kumar', email: 'ravi@example.com', phone: null, isFavourite: false };

  it('starts filled in, with Save disabled until something changes', () => {
    render(<ContactEditForm contact={contact} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Name')).toHaveValue('Ravi Kumar');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(); // isDirty = false
  });

  it('validates on blur (mode: onTouched)', async () => {
    const user = userEvent.setup();
    render(<ContactEditForm contact={contact} onSave={vi.fn()} onCancel={vi.fn()} />);

    await user.clear(screen.getByLabelText('Name'));
    await user.tab();
    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
  });

  it('the Controller-wrapped toggle works like any input, and the payload is sent', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue();
    render(<ContactEditForm contact={contact} onSave={onSave} onCancel={vi.fn()} />);

    const star = screen.getByRole('switch', { name: 'Favourite' });
    await user.click(star);
    expect(star).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ name: 'Ravi Kumar', email: 'ravi@example.com', phone: null, isFavourite: true }),
    );
  });

  it('puts server field errors on the right input with setError', async () => {
    const user = userEvent.setup();
    render(<ContactEditForm contact={contact} onSave={vi.fn().mockRejectedValue(duplicateEmail())} onCancel={vi.fn()} />);

    const email = screen.getByLabelText('Email');
    await user.clear(email);
    await user.type(email, 'asha@example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText("Email 'asha@example.com' is already in use.")).toBeInTheDocument();
    await waitFor(() => expect(email).toHaveFocus()); // shouldFocus moves the user to the problem
  });
});
