'use client';

import { useState } from 'react';
import { localeInfo } from '@ad/shared';
import type { CaptionResult } from '@/lib/data/admin/caption-commands';
import { Switch } from '../fields';

/**
 * The per language Publish switch (M46-S15). Approving a translation never publishes it: viewers see it only
 * after an admin turns this on. It stays off and says why until the track is approved.
 */
export function TranslationPublishSwitch({
  language,
  approved,
  published,
  canPublish,
  onChange,
}: {
  language: string;
  approved: boolean;
  published: boolean;
  canPublish: boolean;
  onChange(next: boolean): Promise<CaptionResult>;
}) {
  const name = localeInfo(language)?.englishName ?? language;
  const [on, setOn] = useState(published);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reason = !approved
    ? 'Approve the captions first. Viewers will not see them until you publish.'
    : !canPublish
      ? 'Only an admin can publish a language.'
      : null;

  async function change(next: boolean) {
    setBusy(true);
    setError(null);
    setOn(next);
    try {
      const result = await onChange(next);
      if (!result.ok) {
        setOn(!next);
        setError(result.error);
      }
    } catch {
      setOn(!next);
      setError('Could not change this. Nothing was changed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-stack">
      <Switch
        label={`Show ${name} captions to viewers`}
        checked={on}
        disabled={reason !== null || busy}
        onLabel="Live"
        offLabel="Not live"
        onChange={(next) => void change(next)}
      />
      {reason ? <p className="adm-muted">{reason}</p> : null}
      {error ? (
        <p role="alert" className="adm-field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
