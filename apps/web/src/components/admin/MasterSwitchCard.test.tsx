// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MasterSwitchCard } from './MasterSwitchCard';
import { ToastProvider } from './Toast';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
afterEach(cleanup);

const view = (enabled: boolean, set = vi.fn().mockResolvedValue({ ok: true })) => {
  render(
    <ToastProvider>
      <MasterSwitchCard enabled={enabled} canChange setSwitch={set} />
    </ToastProvider>,
  );
  return set;
};

describe('MasterSwitchCard', () => {
  it('says off in words when sponsors are off', () => {
    view(false);
    expect(screen.getByText('Sponsors are off. Viewers see nothing.')).toBeTruthy();
  });
  it('asks for the password before turning on', async () => {
    const set = view(false);
    fireEvent.click(screen.getByRole('switch'));
    expect(set).not.toHaveBeenCalled();
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(set).toHaveBeenCalledWith(true, 'pw'));
  });
  it('is read only without permission', () => {
    render(
      <ToastProvider>
        <MasterSwitchCard enabled canChange={false} setSwitch={vi.fn()} />
      </ToastProvider>,
    );
    expect(screen.getByRole('switch').hasAttribute('disabled')).toBe(true);
  });
});
