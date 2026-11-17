'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export interface ToastInput {
  message: string;
  tone?: 'info' | 'success' | 'danger';
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<{ show: (toast: ToastInput) => void } | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) return { show: () => {} };
  return context;
}

/** Info toasts leave after 5 seconds. Error toasts stay until closed (SCREEN-ARCHITECTURE 4.1). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (toast: ToastInput) => {
      const id = Date.now() + Math.random();
      setToasts((all) => [...all, { ...toast, id }]);
      if (toast.tone !== 'danger') setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="adm-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className={`adm-toast adm-toast--${toast.tone ?? 'info'}`} role={toast.tone === 'danger' ? 'alert' : 'status'}>
            <Icon name={toast.tone === 'danger' ? 'alert' : toast.tone === 'success' ? 'check' : 'info'} size={20} />
            <span className="adm-toast__text">{toast.message}</span>
            {toast.actionLabel ? (
              <button type="button" className="adm-toast__btn" onClick={() => { toast.onAction?.(); dismiss(toast.id); }}>
                {toast.actionLabel}
              </button>
            ) : null}
            <button type="button" className="adm-toast__btn" aria-label="Close message" onClick={() => dismiss(toast.id)}>
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
