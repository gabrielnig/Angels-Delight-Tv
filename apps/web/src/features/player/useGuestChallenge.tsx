'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { GuestChallenge } from '../../components/guest/GuestChallenge';

/**
 * The site key a watch page may use. Kids playback pages load no third party script (SECURITY.md section 12), so
 * a visitor in Kids mode gets the plain wait message instead of the check.
 */
export function challengeKeyFor(
  viewer: { guest?: true | undefined; kids: boolean },
  siteKey: string | undefined,
): string | undefined {
  return viewer.guest && !viewer.kids ? siteKey : undefined;
}

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
