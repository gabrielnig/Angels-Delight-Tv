'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md';
  /** Click on the scrim closes. Turn off for destructive and form dialogs. */
  dismissOnScrim?: boolean;
  closeOnEscape?: boolean;
  /** Inline error banner. The dialog stays open. */
  error?: string;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'sm',
  dismissOnScrim = true,
  closeOnEscape = true,
  error,
  className,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialog = dialogRef.current;
    const inerted: HTMLElement[] = [];
    const portalRoot = dialog?.closest('.ad-modal-root');
    for (const child of Array.from(document.body.children)) {
      if (child instanceof HTMLElement && child !== portalRoot && !child.hasAttribute('inert')) {
        child.setAttribute('inert', '');
        inerted.push(child);
      }
    }

    const field = dialog?.querySelector<HTMLElement>(
      '.ad-modal__body input:not([type="hidden"]), .ad-modal__body textarea, .ad-modal__body select',
    );
    (field ?? headingRef.current)?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      for (const child of inerted) child.removeAttribute('inert');
      previous?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && closeOnEscape) {
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === headingRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div className="ad-modal-root" onKeyDown={onKeyDown}>
      <div
        className="ad-modal__scrim"
        data-testid="ad-modal-scrim"
        onClick={dismissOnScrim ? () => onCloseRef.current() : undefined}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx('ad-modal', className)}
        data-size={size}
      >
        <span className="ad-modal__handle" aria-hidden="true" />
        <header className="ad-modal__header">
          <h2 id={titleId} ref={headingRef} tabIndex={-1} className="ad-modal__title">
            {title}
          </h2>
          <IconButton label="Close" icon="close" onClick={() => onCloseRef.current()} />
        </header>
        <div className="ad-modal__body">
          {error ? (
            <p className="ad-modal__error" role="alert">
              <Icon name="error" size={20} />
              <span>{error}</span>
            </p>
          ) : null}
          {children}
        </div>
        {footer ? <footer className="ad-modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger,
  loading,
  error,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  loading?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      error={error}
      dismissOnScrim={!danger}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description ? <p className="ad-modal__text">{description}</p> : null}
      {children}
    </Modal>
  );
}
