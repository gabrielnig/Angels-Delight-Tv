'use client';

import { msg } from '@ad/shared/messages';
import { Button, ButtonLink } from '@ad/ui';
import { formatMoney, type Currency } from '@ad/payments/money';
import { useCallback, useEffect, useRef, useState } from 'react';
import './donate.css';

type View = 'checking' | 'succeeded' | 'processing' | 'failed' | 'cancelled' | 'unknown';
interface Answer {
  status?: string;
  reference?: string;
  amountMinor?: number;
  currency?: Currency;
  kind?: 'one_time' | 'monthly';
}

export interface DonateStatusProps {
  reference: string;
  token: string;
  /** From the Thank you settings. */
  title: string;
  body: string;
  supportEmail: string;
  /** Tests only. */
  fetchImpl?: typeof fetch;
  pollMs?: number;
  maxPolls?: number;
}

/**
 * The honest result of a gift (M48-S29). The page address is never trusted: this asks the server, which reads our
 * own record. While Paystack's message is on its way it says so, and checks again for about thirty seconds.
 */
export function DonateStatus(props: DonateStatusProps) {
  const { reference, token, pollMs = 3000, maxPolls = 10 } = props;
  const [view, setView] = useState<View>('checking');
  const [answer, setAnswer] = useState<Answer>({});
  const polls = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const check = useCallback(async () => {
    let next: View = 'processing';
    let data: Answer = {};
    try {
      const response = await (props.fetchImpl ?? fetch)(
        `/api/donate/status?reference=${encodeURIComponent(reference)}&t=${encodeURIComponent(token)}`,
        { cache: 'no-store' },
      );
      if (response.status === 404) next = 'unknown';
      else if (response.ok) {
        data = (await response.json().catch(() => ({}))) as Answer;
        const s = data.status;
        next = s === 'succeeded' || s === 'failed' || s === 'cancelled' ? s : 'processing';
      }
    } catch {
      next = 'processing';
    }
    if (!alive.current) return;
    setAnswer(data);
    setView(next);
    if (next === 'processing' && polls.current < maxPolls) {
      polls.current += 1;
      timer.current = setTimeout(check, pollMs);
    }
  }, [reference, token, pollMs, maxPolls, props.fetchImpl]);

  useEffect(() => {
    alive.current = true;
    void check();
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [check]);

  const recheck = () => {
    polls.current = 0;
    setView('checking');
    void check();
  };
  const money =
    typeof answer.amountMinor === 'number' && answer.currency ? formatMoney(answer.amountMinor, answer.currency) : null;

  return (
    <div className="donate-state" role="status" aria-live="polite">
      {view === 'succeeded' ? (
        <>
          <h1 className="donate-state__title">{props.title}</h1>
          <p>{props.body}</p>
          {money && answer.reference ? (
            <div className="donate-state__facts">
              <p className="donate-state__amount">{money}</p>
              <p>{msg(answer.kind === 'monthly' ? 'donate.ok.kind.monthly' : 'donate.ok.kind.once')}</p>
              <p>
                {msg('donate.ok.reference')} <span className="donate-state__ref">{answer.reference}</span>
              </p>
            </div>
          ) : null}
          <div className="donate-state__actions">
            <ButtonLink href="/">{msg('donate.ok.home')}</ButtonLink>
          </div>
        </>
      ) : null}
      {view === 'checking' || view === 'processing' ? (
        <>
          <h1 className="donate-state__title">{msg('donate.wait.title')}</h1>
          <p>{msg('donate.wait.body')}</p>
          <div className="donate-state__actions">
            <Button variant="secondary" onClick={recheck} loading={view === 'checking'}>
              {msg('donate.wait.check')}
            </Button>
            <ButtonLink href="/" variant="secondary">
              {msg('donate.ok.home')}
            </ButtonLink>
          </div>
        </>
      ) : null}
      {view === 'failed' ? (
        <>
          <h1 className="donate-state__title">{msg('donate.failed.title')}</h1>
          <p>{msg('donate.failed.body')}</p>
          <div className="donate-state__actions">
            <ButtonLink href="/donate">{msg('donate.failed.retry')}</ButtonLink>
          </div>
        </>
      ) : null}
      {view === 'cancelled' ? (
        <>
          <h1 className="donate-state__title">{msg('donate.cancelled.title')}</h1>
          <p>{msg('donate.cancelled.body')}</p>
          <div className="donate-state__actions">
            <ButtonLink href="/donate">{msg('donate.cancelled.again')}</ButtonLink>
            <ButtonLink href="/" variant="secondary">
              {msg('donate.ok.home')}
            </ButtonLink>
          </div>
        </>
      ) : null}
      {view === 'unknown' ? (
        <>
          <h1 className="donate-state__title">{msg('donate.unknown.title')}</h1>
          <p>{msg('donate.unknown.body', { email: props.supportEmail })}</p>
        </>
      ) : null}
    </div>
  );
}
