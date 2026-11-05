import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import KeysDemo from '../learning/phase-03/KeysDemo';

// This test PROVES the index-key bug, so the checkpoint answer isn't just theory.
async function typeThenAddToTop(sectionName) {
  const user = userEvent.setup();
  render(<KeysDemo />);
  const section = screen.getByRole('region', { name: sectionName });

  await user.type(within(section).getByLabelText('note for Asha'), 'hello');
  await user.click(within(section).getByRole('button', { name: 'Add to top' }));
  return section;
}

describe('KeysDemo', () => {
  it('key={index}: the typed text jumps to the NEW row (bug)', async () => {
    const section = await typeThenAddToTop('key={index} (buggy)');

    expect(within(section).getByLabelText('note for New #3')).toHaveValue('hello'); // wrong row!
    expect(within(section).getByLabelText('note for Asha')).toHaveValue('');
  });

  it('key={item.id}: the typed text stays with Asha (correct)', async () => {
    const section = await typeThenAddToTop('key={item.id} (correct)');

    expect(within(section).getByLabelText('note for Asha')).toHaveValue('hello');
    expect(within(section).getByLabelText('note for New #3')).toHaveValue('');
  });
});
