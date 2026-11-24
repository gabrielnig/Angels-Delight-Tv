// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/auth/TurnstileWidget', () => ({
  TurnstileWidget: ({ onToken }: { onToken: (t: string | null) => void }) => (
    <button onClick={() => onToken('tok')}>pass</button>
  ),
}));

import { useGuestChallenge } from './useGuestChallenge';

function Harness({ siteKey, onResult }: { siteKey?: string; onResult: (v: unknown) => void }) {
  const { solve, element } = useGuestChallenge(siteKey);
  return (
    <>
      <button onClick={() => void Promise.resolve(solve?.()).then(onResult)}>ask</button>
      <p>{solve ? 'can solve' : 'cannot solve'}</p>
      {element}
    </>
  );
}

describe('useGuestChallenge', () => {
  it('cannot solve without a site key, so the player reports a challenge error', () => {
    render(<Harness onResult={vi.fn()} />);
    expect(screen.getByText('cannot solve')).toBeInTheDocument();
  });

  it('opens the check and resolves with the token when passed', async () => {
    const onResult = vi.fn();
    render(<Harness siteKey="k" onResult={onResult} />);
    await userEvent.click(screen.getByRole('button', { name: 'ask' }));
    await userEvent.click(await screen.findByRole('button', { name: 'pass' }));
    await act(async () => undefined);
    expect(onResult).toHaveBeenCalledWith('tok');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('resolves null on Cancel', async () => {
    const onResult = vi.fn();
    render(<Harness siteKey="k" onResult={onResult} />);
    await userEvent.click(screen.getByRole('button', { name: 'ask' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await act(async () => undefined);
    expect(onResult).toHaveBeenCalledWith(null);
  });
});
