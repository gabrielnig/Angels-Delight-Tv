'use client';

import { useT } from '../../lib/i18n/provider';
import { useEffect, useRef } from 'react';

interface TurnstileApi {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ): string;
  reset(id: string): void;
  remove(id: string): void;
}

const SCRIPT_ID = 'cf-turnstile-api';
const api = () => (window as unknown as { turnstile?: TurnstileApi }).turnstile;

/** Loads Cloudflare's script once. Under the CSP, a script added by our own nonce script is trusted (strict-dynamic). */
function whenReady(run: () => void): () => void {
  if (api()) {
    run();
    return () => undefined;
  }
  let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    document.head.append(script);
  }
  const listener = () => run();
  script.addEventListener('load', listener);
  return () => script?.removeEventListener('load', listener);
}

/**
 * The Cloudflare Turnstile check. It reports a token when the person passes and `null` when the token
 * expires or the check fails. A token works once, so bump `resetKey` after every attempt.
 */
export function TurnstileWidget({
  siteKey,
  onToken,
  resetKey = 0,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  resetKey?: number;
}) {
  const msg = useT();
  const host = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const report = useRef(onToken);
  report.current = onToken;
  const firstReset = useRef(resetKey);

  useEffect(() => {
    let cancelled = false;
    const stop = whenReady(() => {
      const turnstile = api();
      if (cancelled || !turnstile || !host.current || widget.current) return;
      widget.current = turnstile.render(host.current, {
        sitekey: siteKey,
        callback: (token) => report.current(token),
        'expired-callback': () => report.current(null),
        'error-callback': () => report.current(null),
      });
    });
    return () => {
      cancelled = true;
      stop();
      if (widget.current) api()?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey === firstReset.current) return;
    if (widget.current) api()?.reset(widget.current);
    report.current(null);
  }, [resetKey]);

  return (
    <div role="group" aria-label={msg('auth.securityCheck')} className="web-turnstile">
      <div ref={host} />
    </div>
  );
}
