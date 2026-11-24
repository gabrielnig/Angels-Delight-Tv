'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { GuestChallenge } from '../../components/guest/GuestChallenge';

/**
 * Lets the player ask a visitor for a Turnstile check when the server wants one (M40-S11). `solve` is undefined
 * without a site key, which makes the player report a challenge error instead of waiting for a check that cannot
 * appear. Render `element` once near the player.
 */
export function useGuestChallenge(siteKey?: string): {
  solve: (() => Promise<string | null>) | undefined;
  element: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const pending = useRef<((token: string | null) => void) | null>(null);

  const finish = useCallback((token: string | null) => {
    pending.current?.(token);
    pending.current = null;
    setOpen(false);
  }, []);

  const solve = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        pending.current?.(null);
        pending.current = resolve;
        setOpen(true);
      }),
    [],
  );

  if (!siteKey) return { solve: undefined, element: null };
  return {
    solve,
    element: (
      <GuestChallenge
        open={open}
        siteKey={siteKey}
        onToken={finish}
        onCancel={() => finish(null)}
      />
    ),
  };
}
