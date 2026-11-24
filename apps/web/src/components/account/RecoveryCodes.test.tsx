// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecoveryCodes } from './RecoveryCodes';

const codes = ['aaaaa-bbbbb', 'ccccc-ddddd'];

describe('RecoveryCodes', () => {
  it('lists the codes and keeps Done off until the box is ticked', async () => {
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<RecoveryCodes codes={codes} onDone={onDone} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'I saved these codes' }));
    expect(done).toBeEnabled();
    await user.click(done);
    expect(onDone).toHaveBeenCalled();
  });

  it('copies the codes and says so politely', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RecoveryCodes codes={codes} onDone={vi.fn()} copy={write} />);
    await user.click(screen.getByRole('button', { name: 'Copy codes' }));
    expect(write).toHaveBeenCalledWith('aaaaa-bbbbb\nccccc-ddddd');
    expect(await screen.findByRole('status')).toHaveTextContent('Codes copied');
  });

  it('offers a text download', () => {
    render(<RecoveryCodes codes={codes} onDone={vi.fn()} />);
    const link = screen.getByRole('link', { name: 'Download codes' });
    expect(link.getAttribute('download')).toMatch(/\.txt$/);
    expect(link.getAttribute('href')).toContain('data:text/plain');
  });
});
