'use client';

import { useT } from '../../lib/i18n/provider';
import { useEffect } from 'react';
import { AcctIcon } from './icons';

/** Dark confirmation bar with a tick and a 44px close button (S28 state 3, S29 state 2). Dismisses itself after 5 s. */
export function InlineToast({
  message,
  onDismiss,
  durationMs = 5000,
}: {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}) {
  const msg = useT();
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [message, onDismiss, durationMs]);
  return (
    <div className="acct-toast" role="status">
      <AcctIcon name="check" size={20} strokeWidth={2.5} />
      <span className="acct-toast__text">{message}</span>
      <button
        type="button"
        className="acct-toast__close"
        aria-label={msg('account.dismiss')}
        onClick={onDismiss}
      >
        <AcctIcon name="close" size={18} />
      </button>
    </div>
  );
}
