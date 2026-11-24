'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { msg } from '@ad/shared/messages';
import { Button } from '@ad/ui';

type Frequency = 'off' | 'daily' | 'weekly';

interface Prefs {
  bell: boolean;
  newEpisodes: boolean;
  newVideos: boolean;
  emailFrequency: Frequency;
  addressMasked: string | null;
  hasAddress: boolean;
  consentedAt: string | null;
}

type SwitchKey = 'bell' | 'newEpisodes' | 'newVideos';

async function call(profileId: string, body?: Record<string, unknown>): Promise<Prefs> {
  const response = body
    ? await fetch('/api/account/notifications', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileId, ...body }),
      })
    : await fetch(`/api/account/notifications?profileId=${encodeURIComponent(profileId)}`);
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json()) as Prefs;
}

function consentDate(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

const SWITCHES: ReadonlyArray<{ key: SwitchKey; label: () => string; hint: () => string }> = [
  { key: 'bell', label: () => msg('engage.notify.bell'), hint: () => msg('engage.notify.bellHint') },
  { key: 'newEpisodes', label: () => msg('engage.notify.episodes'), hint: () => msg('engage.notify.episodesHint') },
  { key: 'newVideos', label: () => msg('engage.notify.videos'), hint: () => msg('engage.notify.videosHint') },
];

const CHOICES: ReadonlyArray<{ value: Frequency; label: () => string; hint: () => string }> = [
  { value: 'off', label: () => msg('engage.notify.emailOff'), hint: () => msg('engage.notify.emailOffHint') },
  { value: 'daily', label: () => msg('engage.notify.emailDaily'), hint: () => msg('engage.notify.emailDailyHint') },
  { value: 'weekly', label: () => msg('engage.notify.emailWeekly'), hint: () => msg('engage.notify.emailWeeklyHint') },
];

/**
 * The account notification card (M44-S14). Switches save as you go and roll back on failure. Email is off until
 * the owner picks Daily or Weekly and confirms in plain words, which records the consent time on the server.
 */
export function NotificationSettings({ profileId }: { profileId: string }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [asking, setAsking] = useState<Frequency | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const group = useId();

  useEffect(() => {
    let live = true;
    call(profileId)
      .then((value) => live && setPrefs(value))
      .catch(() => live && setLoadFailed(true));
    return () => {
      live = false;
      clearTimeout(timer.current);
    };
  }, [profileId]);

  const flashSaved = useCallback(() => {
    setSaved(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), 3000);
  }, []);

  async function save(body: Record<string, unknown>, optimistic: Partial<Prefs>) {
    const before = prefs;
    setFailed(false);
    setPrefs((current) => (current ? { ...current, ...optimistic } : current));
    try {
      setPrefs(await call(profileId, body));
      flashSaved();
    } catch {
      setPrefs(before);
      setFailed(true);
    }
  }

  if (loadFailed)
    return (
      <p role="alert" className="acct-card">
        {msg('engage.notify.loadFailed')}
      </p>
    );
  if (!prefs) return <div className="acct-card" aria-busy="true" />;

  function pickEmail(value: Frequency) {
    if (!prefs || value === prefs.emailFrequency) return;
    if (value === 'off') return void save({ email: { frequency: 'off' } }, { emailFrequency: 'off' });
    // Already agreed once: a change between Daily and Weekly is not a new consent.
    if (prefs.emailFrequency !== 'off') return void save({ email: { frequency: value, confirm: true } }, { emailFrequency: value });
    setAsking(value);
  }

  return (
    <section className="acct-card acct-settings" aria-label={msg('engage.notify.title')}>
      {SWITCHES.map((item) => {
        const labelId = `${group}-${item.key}-l`;
        const hintId = `${group}-${item.key}-h`;
        const on = prefs[item.key];
        return (
          <div className="acct-setting" key={item.key}>
            <div className="acct-setting__text">
              <span id={labelId} className="acct-setting__label">{item.label()}</span>
              <span id={hintId} className="acct-muted acct-small">{item.hint()}</span>
            </div>
            <span className="acct-setting__state" aria-hidden="true">{on ? msg('engage.notify.on') : msg('engage.notify.off')}</span>
            <button
              type="button"
              role="switch"
              className="acct-switch"
              aria-checked={on}
              aria-labelledby={labelId}
              aria-describedby={hintId}
              onClick={() => void save({ [item.key]: !on }, { [item.key]: !on })}
            >
              <span className="acct-switch__track" />
            </button>
          </div>
        );
      })}

      <div className="acct-setting" data-stack>
        <span id={`${group}-email`} className="acct-setting__label">{msg('engage.notify.emailLegend')}</span>
        <div role="radiogroup" aria-labelledby={`${group}-email`} className="acct-choices">
          {CHOICES.map((choice) => (
            <label className="acct-choice" key={choice.value}>
              <input
                type="radio"
                name={`${group}-freq`}
                checked={prefs.emailFrequency === choice.value}
                onChange={() => pickEmail(choice.value)}
              />
              <span className="acct-choice__text">
                <span className="acct-setting__label">{choice.label()}</span>
                <span className="acct-muted acct-small">{choice.hint()}</span>
              </span>
            </label>
          ))}
        </div>
        {prefs.emailFrequency !== 'off' && prefs.addressMasked ? (
          <p className="acct-muted acct-small">{msg('engage.notify.sentTo', { address: prefs.addressMasked })}</p>
        ) : null}
        {prefs.emailFrequency !== 'off' && prefs.consentedAt ? (
          <p className="acct-muted acct-small">{msg('engage.notify.consent', { date: consentDate(prefs.consentedAt) })}</p>
        ) : null}
        {asking ? (
          <div className="acct-confirm" role="group" aria-labelledby={`${group}-ask`}>
            <p id={`${group}-ask`} className="acct-setting__label">
              {asking === 'daily' ? msg('engage.notify.confirmTitleDaily') : msg('engage.notify.confirmTitleWeekly')}
            </p>
            <p className="acct-muted acct-small">{msg('engage.notify.confirmBody')}</p>
            <div className="acct-row" data-tight data-wrap>
              <Button
                onClick={() => {
                  const value = asking;
                  setAsking(null);
                  void save({ email: { frequency: value, confirm: true } }, { emailFrequency: value });
                }}
              >
                {msg('engage.notify.confirmYes')}
              </Button>
              <Button variant="secondary" onClick={() => setAsking(null)}>{msg('engage.notify.confirmNo')}</Button>
            </div>
          </div>
        ) : null}
      </div>

      <p className="acct-muted acct-small">{msg('engage.notify.footer')}</p>
      {saved ? <p role="status" className="acct-small">{msg('engage.notify.saved')}</p> : null}
      {failed ? <p role="alert" className="acct-small">{msg('engage.notify.saveFailed')}</p> : null}
    </section>
  );
}
