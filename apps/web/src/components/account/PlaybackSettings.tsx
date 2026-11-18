'use client';

import { useCallback, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { captionStyleVars, normalizeCaptionStyle } from '@ad/player';
import { Button } from '@ad/ui';
import { savePlaybackAction } from '../../app/actions';
import type { PlaybackSettings } from '../../lib/data';
import { KIDS_LOCKED } from '../../lib/playback-lock';
import { AcctIcon } from './icons';
import { InlineToast } from './InlineToast';

const SPEEDS: [number, string][] = [
  [0.5, '0.5x'],
  [0.75, '0.75x'],
  [1, 'Normal'],
  [1.25, '1.25x'],
  [1.5, '1.5x'],
  [2, '2x'],
];

function Row({
  label,
  hint,
  children,
  id,
}: {
  label: string;
  hint: string;
  children: (ids: { label: string; hint: string }) => ReactNode;
  id: string;
}) {
  return (
    <div className="acct-setting">
      <div className="acct-setting__text">
        <span id={`${id}-l`} className="acct-setting__label">
          {label}
        </span>
        <span id={`${id}-h`} className="acct-muted acct-small">
          {hint}
        </span>
      </div>
      {children({ label: `${id}-l`, hint: `${id}-h` })}
    </div>
  );
}

function Toggle({
  checked,
  locked,
  ids,
  onChange,
}: {
  checked: boolean;
  locked?: boolean;
  ids: { label: string; hint: string };
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="acct-switch"
      aria-checked={checked}
      aria-disabled={locked ? 'true' : undefined}
      aria-labelledby={ids.label}
      aria-describedby={ids.hint}
      onClick={() => {
        if (!locked) onChange(!checked);
      }}
    >
      <span className="acct-switch__track" />
    </button>
  );
}

function Choice({
  value,
  ids,
  onChange,
  children,
}: {
  value: string;
  ids: { label: string; hint: string };
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <span className="acct-select">
      <select
        className="acct-input"
        value={value}
        aria-labelledby={ids.label}
        aria-describedby={ids.hint}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </span>
  );
}

/** Playback preferences (S29). Every change saves at once and rolls back with a notice and Retry if it fails. */
export function PlaybackSettingsForm({
  initial,
  save = savePlaybackAction,
  kids = false,
}: {
  initial: PlaybackSettings;
  save?: (patch: Partial<PlaybackSettings>) => Promise<unknown>;
  kids?: boolean;
}) {
  const base = useId();
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState<Partial<PlaybackSettings> | null>(null);
  const dismiss = useCallback(() => setSaved(false), []);

  async function apply(patch: Partial<PlaybackSettings>) {
    const previous = Object.fromEntries(
      Object.keys(patch).map((k) => [k, values[k as keyof PlaybackSettings]]),
    ) as Partial<PlaybackSettings>;
    setValues((v) => ({ ...v, ...patch }));
    setFailed(null);
    try {
      await save(patch);
      setSaved(true);
    } catch {
      setValues((v) => ({ ...v, ...previous }));
      setSaved(false);
      setFailed(patch);
    }
  }

  const preview = normalizeCaptionStyle({
    size: values.captionSize,
    background: values.captionBackground,
    contrast: values.captionContrast,
  });
  const id = (name: string) => `${base}-${name}`;
  const locked = (key: keyof PlaybackSettings) => kids && KIDS_LOCKED.includes(key);

  return (
    <>
      {kids ? (
        <div className="acct-notice">
          <AcctIcon name="info" size={20} />
          <span className="acct-notice__text">
            You are in a Kids profile. Some settings are managed by a parent account.
          </span>
        </div>
      ) : null}
      {failed ? (
        <div className="acct-notice" data-tone="error" role="alert">
          <AcctIcon name="warning" size={20} />
          <span className="acct-notice__text">
            We could not save that change. Your setting was put back.
          </span>
          <Button variant="secondary" onClick={() => void apply(failed)}>
            Retry
          </Button>
        </div>
      ) : null}
      {saved && !failed ? <InlineToast message="Saved" onDismiss={dismiss} /> : null}
      <form className="acct-card acct-settings" onSubmit={(event) => event.preventDefault()}>
        <Row
          id={id('next')}
          label="Autoplay next episode"
          hint={
            locked('autoplayNext')
              ? 'Set by your parent account.'
              : 'Start the next episode when one ends.'
          }
        >
          {(ids) => (
            <Toggle
              ids={ids}
              checked={values.autoplayNext}
              locked={locked('autoplayNext')}
              onChange={(v) => void apply({ autoplayNext: v })}
            />
          )}
        </Row>
        <Row
          id={id('previews')}
          label="Autoplay previews on Home"
          hint="Play a short silent preview when you hover or pause on a title."
        >
          {(ids) => (
            <Toggle
              ids={ids}
              checked={values.autoplayPreviews}
              onChange={(v) => void apply({ autoplayPreviews: v })}
            />
          )}
        </Row>
        <Row
          id={id('saver')}
          label="Data saver"
          hint={
            locked('dataSaver')
              ? 'Set by your parent account.'
              : 'Data saver keeps video at 480p or lower to use less data. About 20 MB per minute.'
          }
        >
          {(ids) => (
            <Toggle
              ids={ids}
              checked={values.dataSaver}
              locked={locked('dataSaver')}
              onChange={(v) => void apply({ dataSaver: v })}
            />
          )}
        </Row>
        <Row
          id={id('quality')}
          label="Video quality"
          hint="Auto picks the best quality for your network."
        >
          {(ids) => (
            <Choice
              ids={ids}
              value={values.quality}
              onChange={(v) => void apply({ quality: v as PlaybackSettings['quality'] })}
            >
              <option value="auto">Auto</option>
              <option value="1080">1080p</option>
              <option value="720">720p</option>
              <option value="480">480p</option>
              <option value="360">360p</option>
            </Choice>
          )}
        </Row>
        <Row
          id={id('speed')}
          label="Default speed"
          hint="You can change speed in the player at any time."
        >
          {(ids) => (
            <Choice
              ids={ids}
              value={String(values.speed)}
              onChange={(v) => void apply({ speed: Number(v) })}
            >
              {SPEEDS.map(([n, text]) => (
                <option key={n} value={String(n)}>
                  {text}
                </option>
              ))}
            </Choice>
          )}
        </Row>
        <Row
          id={id('captions')}
          label="Captions on by default"
          hint={
            values.captionsDefault
              ? 'Captions are on. You can turn them off in the player.'
              : 'Captions are off. You can turn them on in the player.'
          }
        >
          {(ids) => (
            <Toggle
              ids={ids}
              checked={values.captionsDefault}
              onChange={(v) => void apply({ captionsDefault: v })}
            />
          )}
        </Row>
        <Row id={id('size')} label="Caption size" hint="Applies to all videos.">
          {(ids) => (
            <Choice
              ids={ids}
              value={values.captionSize}
              onChange={(v) => void apply({ captionSize: v as PlaybackSettings['captionSize'] })}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="xlarge">Extra large</option>
            </Choice>
          )}
        </Row>
        <Row id={id('bg')} label="Caption background" hint="The box behind the words.">
          {(ids) => (
            <Choice
              ids={ids}
              value={values.captionBackground}
              onChange={(v) =>
                void apply({ captionBackground: v as PlaybackSettings['captionBackground'] })
              }
            >
              <option value="none">None</option>
              <option value="dark">Dark</option>
              <option value="solid">Solid</option>
            </Choice>
          )}
        </Row>
        <Row
          id={id('contrast')}
          label="High contrast captions"
          hint="Yellow or white text on black, easier to read."
        >
          {(ids) => (
            <Toggle
              ids={ids}
              checked={values.captionContrast === 'high'}
              onChange={(v) => void apply({ captionContrast: v ? 'high' : 'standard' })}
            />
          )}
        </Row>
        <div className="acct-setting" data-block>
          <span className="acct-setting__label">Caption preview</span>
          <div
            className="web-caption-preview acct-preview"
            data-testid="caption-preview"
            style={captionStyleVars(preview) as CSSProperties}
            role="img"
            aria-label="Caption preview"
          >
            <span className="web-caption-preview__text">Plants make food using sunlight.</span>
          </div>
        </div>
      </form>
    </>
  );
}
