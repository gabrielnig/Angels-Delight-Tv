'use client';

import { msg } from '@ad/shared/messages';
import { useState } from 'react';

const LABEL = msg('account.whoIsWatching.label');
const HINT = msg('account.whoIsWatching.hint');

/** One switch row for the device level picker setting (M03-S11). `onSave` rejects when the change did not stick. */
export function AlwaysAskSetting({
  initial,
  onSave,
}: {
  initial: boolean;
  onSave: (value: boolean) => Promise<unknown>;
}) {
  const [on, setOn] = useState(initial);
  const [failed, setFailed] = useState(false);
  const flip = async () => {
    const next = !on;
    setOn(next);
    setFailed(false);
    try {
      await onSave(next);
    } catch {
      setOn(!next);
      setFailed(true);
    }
  };
  return (
    <section className="acct-card acct-settings" aria-label={LABEL}>
      <div className="acct-setting">
        <div className="acct-setting__text">
          <span id="ask-l" className="acct-setting__label">
            {LABEL}
          </span>
          <span id="ask-h" className="acct-muted acct-small">
            {HINT}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          className="acct-switch"
          aria-checked={on}
          aria-labelledby="ask-l"
          aria-describedby="ask-h"
          onClick={flip}
        >
          <span className="acct-switch__track" />
        </button>
      </div>
      {failed ? (
        <p role="alert" className="acct-muted acct-small">
          {msg('account.saveFailed')}
        </p>
      ) : null}
    </section>
  );
}
