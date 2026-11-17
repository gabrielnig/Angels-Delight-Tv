'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button, IconButton } from './Button';
import { Icon, type IconName } from './Icon';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface ToastInput {
  message: string;
  variant?: ToastVariant;
  action?: { label: string; onClick: () => void };
  /** Milliseconds before auto dismiss. Errors never auto dismiss. Default 5000. */
  durationMs?: number;
}

interface ToastItem extends ToastInput {
  id: number;
  variant: ToastVariant;
}

const ICONS: Record<ToastVariant, IconName> = {
  success: 'success',
  info: 'info',
  warning: 'warning',
  error: 'error',
};

interface ToastApi {
  show: (toast: ToastInput) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
}

const DEFAULT_DURATION_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [paused, setPaused] = useState(false);
  const nextId = useRef(1);

  const show = useCallback((toast: ToastInput) => {
    const item: ToastItem = { ...toast, variant: toast.variant ?? 'info', id: nextId.current++ };
    setQueue((current) => [...current, item]);
  }, []);

  const dismiss = useCallback(() => {
    setPaused(false);
    setQueue((current) => current.slice(1));
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const current = queue[0];

  useEffect(() => {
    if (!current || current.variant === 'error' || paused) return;
    const timer = setTimeout(dismiss, current.durationMs ?? DEFAULT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [current, paused, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ad-toasts" aria-live="polite">
        {current ? (
          <div
            key={current.id}
            className="ad-toast"
            data-variant={current.variant}
            role={current.variant === 'error' ? 'alert' : 'status'}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <Icon name={ICONS[current.variant]} size={20} />
            <p className="ad-toast__text">{current.message}</p>
            {current.action ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  current.action?.onClick();
                  dismiss();
                }}
              >
                {current.action.label}
              </Button>
            ) : null}
            <IconButton label="Dismiss" icon="close" iconSize={20} onClick={dismiss} />
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
