'use client';

import { useState, useTransition } from 'react';
import { SelectField, Switch } from './fields';

export type EmailFrequency = 'immediate' | 'hourly' | 'daily';

export interface Prefs {
  failures: boolean;
  captionsReady: boolean;
  dailySummary: boolean;
  emailFrequency: EmailFrequency;
}

type SwitchKey = 'failures' | 'captionsReady' | 'dailySummary';

const FREQUENCIES: Array<{ value: EmailFrequency; label: string }> = [
  { value: 'immediate', label: 'At once' },
  { value: 'hourly', label: 'Hourly summary' },
  { value: 'daily', label: 'Daily summary at 7 in the morning' },
];

interface Props {
  prefs: Prefs;
  save: (
    patch: Partial<Prefs>,
  ) => Promise<{ ok: true; prefs: Prefs } | { ok: false; error: string }>;
}

const ROWS: Array<{ key: SwitchKey; label: string; hint: string }> = [
  { key: 'failures', label: 'Failures', hint: 'Encoding or caption jobs that could not finish.' },
  {
    key: 'captionsReady',
    label: 'Captions ready to review',
    hint: 'When new captions are waiting for you.',
  },
  {
    key: 'dailySummary',
    label: 'Daily summary',
    hint: 'An extra email at 7 in the morning with the last 24 hours.',
  },
];

/** Which emails I get (M21-S05). Saves as each switch changes. Security email is always sent. */
export function NotificationPrefsCard({ prefs, save }: Props) {
  const [values, setValues] = useState(prefs);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  const change = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    const previous = values;
    setValues({ ...values, [key]: value });
    setStatus('idle');
    start(async () => {
      let result: Awaited<ReturnType<typeof save>>;
      try {
        result = await save({ [key]: value });
      } catch {
        result = { ok: false, error: 'Could not save. Try again.' };
      }
      if (result.ok) {
        setValues(result.prefs);
        setStatus('saved');
      } else {
        setValues(previous);
        setError(result.error);
        setStatus('error');
      }
    });
  };

  return (
    <section className="adm-card adm-stack" aria-labelledby="acc-notify">
      <h2 className="adm-h3" id="acc-notify">
        Email notifications
      </h2>
      <p className="adm-muted">Choose which emails you get. Notices always appear in the bell.</p>
      <ul className="adm-stack adm-plain-list">
        {ROWS.map((row) => (
          <li key={row.key} className="adm-row adm-row--between">
            <span>
              <strong>{row.label}</strong>
              <br />
              <span className="adm-muted">{row.hint}</span>
            </span>
            <Switch
              label={row.label}
              checked={values[row.key]}
              disabled={pending}
              onChange={(value) => change(row.key, value)}
            />
          </li>
        ))}
      </ul>
      <SelectField
        label="How often"
        hint="When failure and caption emails arrive. Summaries list everything new since the last one."
        value={values.emailFrequency}
        disabled={pending}
        options={FREQUENCIES}
        onChange={(event) => change('emailFrequency', event.target.value as EmailFrequency)}
      />
      <p className="adm-muted">Security emails, like password resets, are always sent.</p>
      <p role="status" aria-live="polite" className="adm-muted">
        {status === 'saved' ? 'Saved' : ''}
      </p>
      {status === 'error' ? (
        <p role="alert" className="adm-field__error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
