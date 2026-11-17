import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, Modal } from './Modal';

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      <Modal
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Edit name"
        footer={<button>Save</button>}
      >
        <label>
          Name
          <input />
        </label>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        body
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled modal dialog', () => {
    render(
      <Modal open onClose={() => {}} title="Edit name">
        body
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit name' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus to the first field, closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: 'Open it' });
    await user.click(trigger);
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('traps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open it' }));
    const close = screen.getByRole('button', { name: 'Close' });
    const input = screen.getByLabelText('Name');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(input).toHaveFocus();
    await user.tab();
    expect(save).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(input).toHaveFocus();
    await user.tab({ shift: true });
    expect(close).toHaveFocus();
  });

  it('closes from the scrim unless the dialog is a form dialog', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open onClose={onClose} title="Info">
        body
      </Modal>,
    );
    await user.click(screen.getByTestId('ad-modal-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <Modal open onClose={onClose} title="Info" dismissOnScrim={false}>
        body
      </Modal>,
    );
    await user.click(screen.getByTestId('ad-modal-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks background scroll while open', () => {
    const { unmount } = render(
      <Modal open onClose={() => {}} title="Info">
        body
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('shows an inline error banner and keeps the dialog open', () => {
    render(
      <Modal open onClose={() => {}} title="Info" error="Could not save. Try again.">
        body
      </Modal>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save. Try again.');
  });
});

describe('ConfirmDialog', () => {
  it('names the action and its consequence with a danger button', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete this profile?"
        description="Its history and list will be deleted. This cannot be undone."
        confirmLabel="Delete profile"
        cancelLabel="Keep it"
        danger
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Delete profile' });
    expect(confirm).toHaveAttribute('data-variant', 'danger');
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a loading state on the confirm button', () => {
    render(
      <ConfirmDialog
        open
        title="Delete?"
        confirmLabel="Delete"
        cancelLabel="Keep it"
        loading
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /Delete/ })).toHaveAttribute('aria-busy', 'true');
  });
});
