'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';

/**
 * Modal built on the native dialog element: focus is trapped, Esc closes, focus returns to the
 * trigger. DESIGN-SYSTEM 11.12. Becomes a bottom sheet on small screens through CSS.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  description,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (open) return;
    const node = opener.current;
    if (node instanceof HTMLElement && document.contains(node)) node.focus();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`adm-dialog adm-dialog--${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open ? (
        <div className="adm-dialog__body">
          <h2 id={titleId} className="adm-dialog__title">
            {title}
          </h2>
          {description ? (
            <p id={descId} className="adm-dialog__desc">
              {description}
            </p>
          ) : null}
          {children}
          {footer ? <div className="adm-dialog__footer">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** Names the object and states the consequence (SCREEN-ARCHITECTURE 4.3). */
export function ConfirmDialog({
  open,
  title,
  consequence,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  consequence: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={consequence}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
