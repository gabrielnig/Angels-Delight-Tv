'use client';

import { useEffect, useState } from 'react';
import { localeInfo } from '@ad/shared';
import type { CaptionResult } from '@/lib/data/admin/caption-commands';
import type { TranslationEstimateView } from '@/lib/data/admin/services';
import { Button } from '../Button';
import { Dialog } from '../Dialog';

/** Choose a language, see the estimate, confirm (M46-S15). Starting only queues a draft that a person reviews. */
export function AddTranslationDialog({
  open,
  onClose,
  languages,
  spoken,
  estimate,
  start,
}: {
  open: boolean;
  onClose(): void;
  /** Languages that are turned on for captions and do not have a translation yet. */
  languages: string[];
  spoken: string;
  estimate(language: string): Promise<TranslationEstimateView>;
  start(language: string): Promise<CaptionResult>;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [info, setInfo] = useState<TranslationEstimateView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!chosen) return;
    let live = true;
    setInfo(null);
    setError(null);
    estimate(chosen).then(
      (value) => live && setInfo(value),
      () => live && setError('Could not work out the estimate. Try again.'),
    );
    return () => {
      live = false;
    };
  }, [chosen, estimate]);

  async function go() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const result = await start(chosen);
      if (result.ok) onClose();
      else setError(result.error);
    } catch {
      setError('Could not start the translation. Nothing was changed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const ready = info !== null && info.configured && info.supported;
  const sourceName = localeInfo(spoken)?.englishName ?? spoken;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a translation"
      description={`Translates the approved ${sourceName} captions. Timing is copied as it is.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {ready ? (
            <Button onClick={() => void go()} disabled={busy}>
              Start translation
            </Button>
          ) : null}
        </>
      }
    >
      {languages.length === 0 ? (
        <p>Every caption language already has a translation. Turn on more languages in the content settings.</p>
      ) : (
        <fieldset className="adm-fieldset">
          <legend>Language</legend>
          {languages.map((code) => (
            <label key={code} className="adm-radio">
              <input type="radio" name="translation-language" value={code} onChange={() => setChosen(code)} />
              <span>{`${localeInfo(code)?.englishName ?? code}`}</span>
            </label>
          ))}
        </fieldset>
      )}
      {info && !info.configured ? (
        <p>Translation is not set up on this server yet. Ask the developer to turn it on.</p>
      ) : null}
      {info && info.configured && !info.supported ? <p>The translation engine cannot do this language.</p> : null}
      {ready ? (
        <div className="adm-stack">
          <p>
            {`${info.cues} cues, ${info.characters.toLocaleString('en-NG')} characters.`}
            {info.estimatedUsd !== null
              ? ` Cost with ${info.provider}: about USD ${info.estimatedUsd.toFixed(2)}.`
              : ` ${info.provider} has no per use cost.`}
          </p>
          <p className="adm-muted">A person reviews it before viewers see anything.</p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="adm-field__error">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
