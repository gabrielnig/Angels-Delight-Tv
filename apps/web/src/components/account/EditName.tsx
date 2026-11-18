'use client';

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
          result.reason === 'invalid'
            ? 'Enter a name of 1 to 80 characters.'
            : 'We could not save your name. Try again.',
        );
      }
    } catch {
      setProblem('We could not save your name. Try again.');
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
        Edit name
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Edit your name"
        className="acct-dialog"
        hideClose
        dismissOnScrim={false}
      >
        <form className="acct-dialog__form" onSubmit={(event) => void onSubmit(event)} noValidate>
          <div>
            <label className="acct-field__label" htmlFor="acct-name">
              Your name
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
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save name
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
