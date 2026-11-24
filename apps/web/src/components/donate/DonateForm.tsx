'use client';

import { msg } from '@ad/shared/messages';
import { Button, ButtonLink, Input, Switch } from '@ad/ui';
import { formatMoney, toMinor, type Currency } from '@ad/payments/money';
import { useRef, useState, type FormEvent } from 'react';
import './donate.css';

export interface DonateFormProps {
  currencies: Currency[];
  presets: Record<Currency, number[]>;
  limits: Record<Currency, { min: number; max: number }>;
  monthlyEnabled: boolean;
  orgName: string;
  testMode: boolean;
  /** Tests only. */
  fetchImpl?: typeof fetch;
  navigate?: (url: string) => void;
}

type Phase = 'idle' | 'sending' | 'redirect';

const defaultPreset = (list: number[]) => list[1] ?? list[0] ?? null;
const newAttempt = () => globalThis.crypto.randomUUID();
const goTo = (url: string) => window.location.assign(url);

/**
 * The donate form (M48-S25, S26). It only collects an amount and an email and asks our server for a Paystack page,
 * then navigates there, so no card detail is ever typed on our site. The amount is checked here for kindness and
 * again on the server for safety. Nothing third party loads.
 */
export function DonateForm(props: DonateFormProps) {
  const { currencies, presets, limits, monthlyEnabled, orgName, testMode } = props;
  const [currency, setCurrency] = useState<Currency>(currencies[0] ?? 'NGN');
  const [preset, setPreset] = useState<number | null>(defaultPreset(presets[currencies[0] ?? 'NGN']));
  const [custom, setCustom] = useState<string | null>(null);
  const [customTouched, setCustomTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [name, setName] = useState('');
  const [monthly, setMonthly] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [failure, setFailure] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const attempt = useRef(newAttempt());
  const limit = limits[currency];
  const edited = () => {
    // Any change is a new request, so a retry never gets the page of an older amount back.
    attempt.current = newAttempt();
    setFailure(null);
  };

  const customError = (): string | null => {
    if (custom === null) return null;
    if (!/^\d{1,10}$/.test(custom.trim())) return msg('donate.err.amountInvalid');
    const minor = toMinor(custom.trim(), currency);
    if (minor === null) return msg('donate.err.amountInvalid');
    if (minor < limit.min) return msg('donate.err.amountLow', { amount: formatMoney(limit.min, currency) });
    if (minor > limit.max) return msg('donate.err.amountHigh', { amount: formatMoney(limit.max, currency) });
    return null;
  };
  const amountMinor = (): number | null =>
    custom !== null ? (customError() === null && custom.trim() ? toMinor(custom.trim(), currency) : null) : preset;
  const emailError = (): string | null =>
    /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email.trim()) ? null : msg('donate.err.emailInvalid');

  const shownCustomError = customTouched ? customError() : null;
  const shownEmailError = emailTouched ? emailError() : null;
  const amount = amountMinor();
  const submitLabel =
    phase === 'sending'
      ? msg('donate.sending')
      : amount === null
        ? msg('donate.give.pick')
        : msg(monthly ? 'donate.give.monthly' : 'donate.give.once', { amount: formatMoney(amount, currency) });

  const pickCurrency = (next: Currency) => {
    setCurrency(next);
    setPreset(defaultPreset(presets[next]));
    setCustom(null);
    setCustomTouched(false);
    edited();
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (phase !== 'idle') return;
    if (custom !== null) setCustomTouched(true);
    setEmailTouched(true);
    if (amount === null) {
      document.getElementById('donate-custom')?.focus();
      return;
    }
    if (emailError()) {
      document.getElementById('donate-email')?.focus();
      return;
    }
    setPhase('sending');
    setFailure(null);
    try {
      const response = await (props.fetchImpl ?? fetch)('/api/donate/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amountMinor: amount,
          currency,
          email: email.trim(),
          ...(name.trim() ? { name: name.trim() } : {}),
          attemptId: attempt.current,
          kind: monthly ? 'monthly' : 'one_time',
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { url?: unknown; error?: unknown };
      if (response.ok && typeof data.url === 'string' && data.url.startsWith('https://')) {
        setRedirectUrl(data.url);
        setPhase('redirect');
        (props.navigate ?? goTo)(data.url);
        return;
      }
      setPhase('idle');
      attempt.current = newAttempt();
      if (response.status === 429) setFailure(msg('donate.err.rateLimited'));
      else if (data.error === 'provider') setFailure(msg('donate.err.provider'));
      else if (data.error === 'amount_low') setFailure(msg('donate.err.amountLow', { amount: formatMoney(limit.min, currency) }));
      else if (data.error === 'amount_high') setFailure(msg('donate.err.amountHigh', { amount: formatMoney(limit.max, currency) }));
      else setFailure(msg('donate.err.generic'));
    } catch {
      setPhase('idle');
      attempt.current = newAttempt();
      setFailure(msg('donate.err.network'));
    }
  }

  if (phase === 'redirect' && redirectUrl && amount !== null) {
    return (
      <section className="donate-redirect" aria-live="polite">
        <h2 className="donate-redirect__title">{msg('donate.redirect.title')}</h2>
        <p>{msg('donate.redirect.body', { amount: formatMoney(amount, currency) })}</p>
        <p>
          {msg('donate.redirect.stuck')}{' '}
          <ButtonLink href={redirectUrl} variant="secondary">
            {msg('donate.redirect.continue')}
          </ButtonLink>
        </p>
      </section>
    );
  }

  return (
    <form className="donate-form" onSubmit={submit} noValidate>
      {testMode ? (
        <p className="donate-form__test" role="note">
          {msg('donate.testMode')}
        </p>
      ) : null}
      {failure ? (
        <p className="donate-form__error" role="alert">
          {failure}
        </p>
      ) : null}
      {currencies.length > 1 ? (
        <div role="group" aria-label={msg('donate.currency')} className="donate-form__row">
          {currencies.map((c) => (
            <button
              key={c}
              type="button"
              className="donate-chip"
              aria-pressed={currency === c}
              onClick={() => pickCurrency(c)}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}
      <fieldset className="donate-form__amounts">
        <legend className="donate-form__legend">{msg('donate.chooseAmount')}</legend>
        <div className="donate-form__row">
          {presets[currency].map((minor) => (
            <button
              key={minor}
              type="button"
              className="donate-chip"
              aria-pressed={custom === null && preset === minor}
              onClick={() => {
                setPreset(minor);
                setCustom(null);
                setCustomTouched(false);
                edited();
              }}
            >
              {formatMoney(minor, currency)}
            </button>
          ))}
          <button
            type="button"
            className="donate-chip"
            aria-pressed={custom !== null}
            onClick={() => {
              setCustom('');
              edited();
              setTimeout(() => document.getElementById('donate-custom')?.focus(), 0);
            }}
          >
            {msg('donate.other')}
          </button>
        </div>
        {custom !== null ? (
          <Input
            label={msg('donate.otherLabel', { currency })}
            value={custom}
            inputMode="numeric"
            autoComplete="off"
            error={shownCustomError ?? undefined}
            onChange={(e) => {
              setCustom(e.target.value.replace(/[^\d]/g, ''));
              edited();
            }}
            onBlur={() => setCustomTouched(true)}
            id="donate-custom"
          />
        ) : null}
      </fieldset>
      {monthlyEnabled ? (
        <Switch
          label={msg('donate.monthly')}
          hint={msg('donate.monthlyHint')}
          checked={monthly}
          onCheckedChange={(next) => {
            setMonthly(next);
            edited();
          }}
        />
      ) : null}
      <Input
        label={msg('donate.email')}
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        error={shownEmailError ?? undefined}
        onChange={(e) => {
          setEmail(e.target.value);
          edited();
        }}
        onBlur={() => setEmailTouched(true)}
        id="donate-email"
      />
      <Input
        label={msg('donate.name')}
        autoComplete="name"
        maxLength={80}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          edited();
        }}
        id="donate-name"
      />
      {currency === 'USD' ? <p className="donate-form__note">{msg('donate.usdNote')}</p> : null}
      <Button type="submit" size="lg" fullWidth loading={phase === 'sending'}>
        {submitLabel}
      </Button>
      <p className="donate-form__note">{msg('donate.secure')}</p>
      {orgName ? <p className="donate-form__note">{msg('donate.receivedBy', { org: orgName })}</p> : null}
    </form>
  );
}
