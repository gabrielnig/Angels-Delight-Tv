'use client';

import { useActionState, useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { Button } from '@/components/admin/Button';
import { verifyCodeAction } from '../actions';
import type { CodeState } from '../actions';

/** Six slot code entry. Paste fills all slots, Backspace moves back (DESIGN-SYSTEM 11.3). */
export function CodeForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(verifyCodeAction, {});
  const slots = useRef<Array<HTMLInputElement | null>>([]);
  const hidden = useRef<HTMLInputElement>(null);

  const sync = () => {
    if (hidden.current) hidden.current.value = slots.current.map((s) => s?.value ?? '').join('');
  };
  const onInput = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const slot = slots.current[index];
    if (slot) slot.value = digit;
    sync();
    if (digit) slots.current[index + 1]?.focus();
  };
  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !slots.current[index]?.value) slots.current[index - 1]?.focus();
  };
  const onPaste = (event: ClipboardEvent) => {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    event.preventDefault();
    digits.split('').forEach((d, i) => {
      if (slots.current[i]) slots.current[i]!.value = d;
    });
    sync();
    slots.current[Math.min(digits.length, 5)]?.focus();
  };

  return (
    <form action={action} className="adm-stack">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="code" ref={hidden} />
      <div className="adm-code" role="group" aria-label="6 digit code" onPaste={onPaste}>
        {Array.from({ length: 6 }, (_, index) => (
          <input
            key={index}
            ref={(node) => {
              slots.current[index] = node;
            }}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            aria-label={`Digit ${index + 1} of 6`}
            onChange={(event) => onInput(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(index, event)}
            autoFocus={index === 0}
          />
        ))}
      </div>
      {state.error ? (
        <p role="alert" className="adm-field__error">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" loading={pending}>
        Verify
      </Button>
    </form>
  );
}
