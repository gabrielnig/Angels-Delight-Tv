// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SponsorForm } from './SponsorForm';
import { ToastProvider } from './Toast';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push }) }));
afterEach(cleanup);

const view = (save = vi.fn().mockResolvedValue({ ok: true, id: 'abc' })) => {
  render(
    <ToastProvider>
      <SponsorForm save={save} />
    </ToastProvider>,
  );
  return save;
};

describe('SponsorForm', () => {
  it('sends what was typed and goes to the editor', async () => {
    const save = view();
    fireEvent.change(screen.getByLabelText('Sponsor name'), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText('Starts on'), { target: { value: '2027-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save sponsor' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0]![0]).toMatchObject({ name: 'Acme', startDay: '2027-01-01' });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/sponsors/abc'));
  });
  it('shows a field error next to the field', async () => {
    const save = vi
      .fn()
      .mockResolvedValue({ ok: false, error: 'Some details need fixing', fields: { name: ['Add a name.'] } });
    view(save);
    fireEvent.click(screen.getByRole('button', { name: 'Save sponsor' }));
    expect((await screen.findByText('Add a name.')).getAttribute('role')).toBe('alert');
  });
});
