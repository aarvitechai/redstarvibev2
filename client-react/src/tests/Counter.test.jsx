import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import Counter from '../components/counter/Counter';

const count = () => screen.getByLabelText('count');
const click = (user, name) => user.click(screen.getByRole('button', { name }));

describe('Counter', () => {
  it('increments, decrements and resets', async () => {
    const user = userEvent.setup();
    render(<Counter />);

    await click(user, '+ 1');
    await click(user, '+ 1');
    expect(count()).toHaveTextContent('2');
    expect(screen.getByText('Even')).toBeInTheDocument();

    await click(user, '− 1');
    expect(count()).toHaveTextContent('1');
    expect(screen.getByText('Odd')).toBeInTheDocument();

    await click(user, 'Reset');
    expect(count()).toHaveTextContent('0');
  });

  it('disables decrement when it would go below min', () => {
    render(<Counter />);
    expect(screen.getByRole('button', { name: '− 1' })).toBeDisabled();
  });

  it('setCount(count + 1) three times adds only 1 (stale snapshot)', async () => {
    const user = userEvent.setup();
    render(<Counter />);
    await click(user, '+3 (wrong)');
    expect(count()).toHaveTextContent('1');
  });

  it('setCount(c => c + 1) three times adds 3 (functional update)', async () => {
    const user = userEvent.setup();
    render(<Counter />);
    await click(user, '+3 (functional)');
    expect(count()).toHaveTextContent('3');
  });

  it('uses the step value', async () => {
    const user = userEvent.setup();
    render(<Counter />);
    const step = screen.getByRole('spinbutton');
    await user.tripleClick(step); // select the current value, then replace it
    await user.keyboard('5');
    await click(user, '+ 5');
    expect(count()).toHaveTextContent('5');
  });

  it('clamps the step to 1..10 even though the input lets you type more', async () => {
    const user = userEvent.setup();
    render(<Counter />);
    const step = screen.getByRole('spinbutton');
    await user.tripleClick(step);
    await user.keyboard('99');
    expect(step).toHaveValue(10);
  });
});
