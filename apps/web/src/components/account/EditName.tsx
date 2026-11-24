'use client';

import { useT } from '../../lib/i18n/provider';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Modal } from '@ad/ui';
import { updateNameAction } from '../../app/actions';
import { AcctIcon } from './icons';

type Result = { ok: true; name: string } | { ok: false; reason: 'invalid' | 'network' };

/** The Edit name button and its small dialog (S27). */
export function EditName({
  name,
  save = updateNameAction,
}: {
  name: string;
  save?: (input: { name: string }) => Promise<Result>;
}) {
  const msg = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(false);
    setProblem(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const result = await save({ name: value });
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setProblem(
          result.reason === 'invalid' ? msg('account.enterANameOf') : msg('account.weCouldNotSave'),
        );
      }
    } catch {
      setProblem(msg('account.weCouldNotSave'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setValue(name);
          setOpen(true);
        }}
      >
        {msg('account.editName')}
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={msg('account.editYourName')}
        className="acct-dialog"
        hideClose
        dismissOnScrim={false}
      >
        <form className="acct-dialog__form" onSubmit={(event) => void onSubmit(event)} noValidate>
          <div>
            <label className="acct-field__label" htmlFor="acct-name">
              {msg('account.yourName')}
            </label>
            <input
              id="acct-name"
              className="acct-input"
              value={value}
              maxLength={80}
              autoComplete="name"
              aria-invalid={problem ? 'true' : undefined}
              aria-describedby={problem ? 'acct-name-error' : undefined}
              onChange={(event) => setValue(event.target.value)}
            />
            {problem ? (
              <p id="acct-name-error" className="acct-field__error" role="alert">
                <AcctIcon name="warning" size={16} />
                <span>{problem}</span>
              </p>
            ) : null}
          </div>
          <div className="acct-dialog__actions">
            <Button variant="secondary" onClick={close}>
              {msg('account.cancel')}
            </Button>
            <Button type="submit" loading={busy}>
              {msg('account.saveName')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
