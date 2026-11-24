'use client';

import { useState } from 'react';
import { Button, Checkbox } from '@ad/ui';
import { msg } from '@ad/shared/messages';

/** Ten single use codes, shown once (S172). Done stays off until the person says they saved them. */
export function RecoveryCodes({
  codes,
  onDone,
  copy = (text: string) => navigator.clipboard.writeText(text),
}: {
  codes: string[];
  onDone: () => void;
  copy?: (text: string) => Promise<void>;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');

  async function onCopy() {
    try {
      await copy(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="acct-col" data-gap="2">
      <h3 className="acct-h2">{msg('account.twoStep.codesTitle')}</h3>
      <p className="acct-muted">{msg('account.twoStep.codesLead')}</p>
      <ul className="acct-codes" role="list">
        {codes.map((code) => (
          <li key={code} className="acct-code">
            {code}
          </li>
        ))}
      </ul>
      <div className="acct-row" data-tight data-wrap>
        <Button variant="secondary" onClick={() => void onCopy()}>
          {msg('account.twoStep.copy')}
        </Button>
        <a
          className="ad-btn"
          data-variant="secondary"
          data-size="md"
          download="backup-codes.txt"
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
        >
          {msg('account.twoStep.download')}
        </a>
      </div>
      <p className="acct-small" role="status">
        {copied ? msg('account.twoStep.copied') : ''}
      </p>
      <Checkbox
        label={msg('account.twoStep.saved')}
        checked={saved}
        onChange={(event) => setSaved(event.target.checked)}
      />
      <div>
        <Button disabled={!saved} onClick={onDone}>
          {msg('account.twoStep.done')}
        </Button>
      </div>
    </div>
  );
}
