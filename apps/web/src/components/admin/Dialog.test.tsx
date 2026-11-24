// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, TypedConfirmDialog } from './Dialog';

afterEach(cleanup);

function Typed({ onConfirm = () => {} }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <TypedConfirmDialog
        open={open}
        title="Delete 7 videos forever?"
        consequence="This removes them for everyone. This cannot be undone."
        phrase="7"
        phraseLabel="Type 7 to confirm"
        confirmLabel="Delete 7 videos"
        onConfirm={onConfirm}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const confirm = () => screen.getByRole('button', { name: 'Delete 7 videos' });

describe('TypedConfirmDialog', () => {
  it('keeps the danger button disabled until the typed text matches', () => {
    render(<Typed />);
    fireEvent.click(screen.getByText('Open'));
    expect(confirm()).toHaveAttribute('aria-disabled', 'true');
    fireEvent.change(screen.getByLabelText('Type 7 to confirm'), { target: { value: '6' } });
    expect(confirm()).toHaveAttribute('aria-disabled', 'true');
    fireEvent.change(screen.getByLabelText('Type 7 to confirm'), { target: { value: '7' } });
    expect(confirm()).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('matching is exact and ignores surrounding spaces', () => {
    const onConfirm = vi.fn();
    render(<Typed onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Open'));
    fireEvent.change(screen.getByLabelText('Type 7 to confirm'), { target: { value: '  7 ' } });
    fireEvent.click(confirm());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('a word phrase is exact, so a partial or longer value does not match', () => {
    const onConfirm = vi.fn();
    render(
      <TypedConfirmDialog
        open
        title="Delete this video forever?"
        consequence="Gone."
        phrase="delete"
        phraseLabel="Type delete"
        confirmLabel="Delete video"
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    );
    const field = screen.getByLabelText('Type delete');
    fireEvent.change(field, { target: { value: 'delet' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete video' }));
    fireEvent.change(field, { target: { value: 'delete now' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete video' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('focus returns to the opener on close', () => {
    render(<Typed />);
    const opener = screen.getByText('Open');
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(opener);
  });
});

describe('ConfirmDialog acknowledge option', () => {
  it('acknowledge checkbox must be ticked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Approve 9 captions?"
        consequence="They become public."
        confirmLabel="Approve 9"
        acknowledge="I understand and approve them anyway"
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approve 9' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('I understand and approve them anyway'));
    fireEvent.click(screen.getByRole('button', { name: 'Approve 9' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('without the option the button works at once', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="T" consequence="C" confirmLabel="Go" onConfirm={onConfirm} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
