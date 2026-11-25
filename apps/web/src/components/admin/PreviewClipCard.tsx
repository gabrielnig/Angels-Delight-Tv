'use client';

import { useState } from 'react';
import type { PreviewInfo } from '@/lib/data/admin/types';
import type { CommandResult, PreviewModeInput } from '@/lib/data/admin/video-commands';
import { Badge } from './Badge';
import { Button } from './Button';
import { TextField } from './fields';
import { Card } from './PageHeader';

/** Reads "0:12", "1:05.3" or "45" as milliseconds. Null when it is not a time inside the 100 ms steps. */
export function parseClock(text: string): number | null {
  const match = /^(?:(\d{1,3}):)?(\d{1,2})(?:\.(\d))?$/.exec(text.trim());
  if (!match) return null;
  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2]);
  if (match[1] !== undefined && seconds > 59) return null;
  return minutes * 60_000 + seconds * 1000 + Number(match[3] ?? 0) * 100;
}

export function formatClock(ms: number): string {
  const tenths = Math.floor((ms % 1000) / 100);
  const base = `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;
  return tenths ? `${base}.${tenths}` : base;
}

export const PREVIEW_STATES: Record<PreviewInfo['state'], { word: string; tone: 'neutral' | 'info' | 'success' | 'danger' | 'warning' }> = {
  none: { word: 'Not made yet', tone: 'neutral' },
  queued: { word: 'Queued', tone: 'info' },
  ready: { word: 'Ready', tone: 'success' },
  failed: { word: 'Failed', tone: 'danger' },
  skipped: { word: 'Skipped', tone: 'warning' },
};

const MODES = [
  { value: 'auto', title: 'Automatic', text: 'We choose the best part of the video.' },
  { value: 'picked', title: 'Pick a segment', text: 'You choose where the clip starts.' },
  { value: 'off', title: 'Off', text: 'Home shows the poster only.' },
] as const;

/** The Home hero clip for one video: state, how it is chosen, and Retry (M41-S10). */
export function PreviewClipCard({
  preview,
  durationSeconds,
  canEdit,
  onSetMode,
  onRetry,
}: {
  preview: PreviewInfo;
  durationSeconds: number;
  canEdit: boolean;
  onSetMode(input: PreviewModeInput): Promise<CommandResult>;
  onRetry(): Promise<CommandResult>;
}) {
  const [mode, setMode] = useState(preview.mode);
  const [start, setStart] = useState(preview.startMs === null ? '' : formatClock(preview.startMs));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const state = PREVIEW_STATES[preview.state];
  const changed = mode !== preview.mode || (mode === 'picked' && start !== (preview.startMs === null ? '' : formatClock(preview.startMs)));

  async function run(work: () => Promise<CommandResult>) {
    setBusy(true);
    setError(undefined);
    try {
      const result = await work();
      if (!result.ok) setError(result.error);
    } catch {
      setError('That did not work. Nothing was changed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (mode !== 'picked') return void run(() => onSetMode({ mode }));
    const startMs = parseClock(start);
    if (startMs === null) return setError('Use minutes and seconds, such as 0:12');
    void run(() => onSetMode({ mode: 'picked', startMs }));
  }

  return (
    <Card title="Home preview clip">
      <div className="adm-stack">
        <p className="adm-muted" style={{ margin: 0 }}>
          A short clip can play on the Home hero for viewers on fast connections. It starts muted and viewers can turn the sound on. Video length{' '}
          {formatClock(durationSeconds * 1000)}.
        </p>
        <p style={{ margin: 0 }}>
          <Badge tone={state.tone}>{state.word}</Badge>
        </p>
        {preview.note && (preview.state === 'failed' || preview.state === 'skipped') ? (
          <p style={{ margin: 0 }}>
            <span>{preview.note}</span>
            <br />
            <span className="adm-muted">Home shows the poster instead.</span>
          </p>
        ) : null}
        <fieldset className="adm-viewall" disabled={!canEdit || busy}>
          <legend className="adm-field__label">How the clip is chosen</legend>
          {MODES.map((choice) => (
            <label key={choice.value} className={`adm-viewall__opt${mode === choice.value ? ' is-on' : ''}`}>
              <input
                type="radio"
                name="preview-mode"
                checked={mode === choice.value}
                onChange={() => {
                  setMode(choice.value);
                  setError(undefined);
                }}
              />
              <span>
                <strong>{choice.title}</strong>
                <span className="adm-muted">{choice.text}</span>
              </span>
            </label>
          ))}
          {mode === 'picked' ? (
            <TextField
              label="Start at"
              value={start}
              placeholder="0:12"
              inputMode="decimal"
              autoComplete="off"
              hint="Minutes and seconds. The clip plays from here for the clip length in Site settings."
              onChange={(e) => {
                setStart(e.target.value);
                setError(undefined);
              }}
            />
          ) : null}
        </fieldset>
        {error ? (
          <p className="adm-field__error" role="alert">
            {error}
          </p>
        ) : null}
        {canEdit ? (
          <div className="adm-row">
            <Button variant="primary" disabled={!changed || busy} loading={busy} onClick={save}>
              Save preview setting
            </Button>
            {(preview.state === 'failed' || preview.state === 'skipped') && preview.mode !== 'off' ? (
              <Button disabled={busy} onClick={() => void run(onRetry)}>
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
