'use client';

import { useState, type ReactNode } from 'react';
import { TurnstileWidget } from './TurnstileWidget';

export interface TurnstileState {
  enabled: boolean;
  /** A token for one attempt, or null while the check runs or after it was spent. */
  token: string | null;
  widget: ReactNode;
  /** Call after every attempt: a token works once, so the widget starts a new check. */
  spent(): void;
}

export const CHECK_RUNNING_MESSAGE =
  'The security check is still running. Wait a moment, then try again.';

/** The Turnstile check for a form. Does nothing when no site key is given, so forms work without keys. */
export function useTurnstile(siteKey?: string): TurnstileState {
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  return {
    enabled: Boolean(siteKey),
    token,
    widget: siteKey ? (
      <TurnstileWidget siteKey={siteKey} onToken={setToken} resetKey={resetKey} />
    ) : null,
    spent() {
      if (!siteKey) return;
      setToken(null);
      setResetKey((key) => key + 1);
    },
  };
}
