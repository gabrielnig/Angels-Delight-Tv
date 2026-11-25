'use client';

import { usePathname } from 'next/navigation';
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
import type { PanelData } from '@/lib/admin/help-panel';
import { HelpPanel, type PanelView } from './HelpPanel';
import type { TranscriptCue } from './HelpVideo';

export type PanelResult = { ok: true; data: PanelData; cues: TranscriptCue[] } | { ok: false };

export interface OpenOptions {
  /** Show this guide first, for example from an inline hint. */
  guide?: string;
  /** A step or section id inside the guide to scroll to. */
  section?: string;
}

interface PanelApi {
  /** False outside the admin shell, so a hint falls back to a plain link. */
  available: boolean;
  isOpen: boolean;
  open: (options?: OpenOptions) => void;
  close: () => void;
}

const Ctx = createContext<PanelApi>({
  available: false,
  isOpen: false,
  open: () => {},
  close: () => {},
});

/** Lets the Help button and the inline hints open the contextual help panel (M50-S03). */
export const useHelpPanel = (): PanelApi => useContext(Ctx);

const SKELETON_AFTER_MS = 300;
const SLOW_AFTER_MS = 6000;

const isTyping = (el: Element | null): boolean =>
  !!el &&
  ((el as HTMLElement).isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/**
 * Owns the open state, the loading of the guide for the current screen and the keys. The panel is a drawer from md
 * and up and a bottom sheet on phones. Nothing is stored: guides already read stay in memory for this visit, so they
 * still show when the connection drops.
 */
export function HelpPanelHost({
  load,
  onWatched,
  children,
}: {
  load: (pathname: string, guide?: string) => Promise<PanelResult>;
  onWatched: (guide: string) => Promise<{ ok: boolean }>;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? '/admin';
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<OpenOptions>({});
  const [view, setView] = useState<PanelView>({ phase: 'loading' });
  const [online, setOnline] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [slow, setSlow] = useState(false);
  const [tick, setTick] = useState(0);
  const opener = useRef<HTMLElement | null>(null);
  const cache = useRef(new Map<string, { data: PanelData; cues: TranscriptCue[] }>());
  const key = `${pathname}|${request.guide ?? ''}`;

  const openPanel = useCallback((options: OpenOptions = {}) => {
    const active = document.activeElement as HTMLElement | null;
    opener.current = active && active !== document.body ? active : null;
    setRequest(options);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    const target = opener.current?.isConnected
      ? opener.current
      : document.querySelector<HTMLElement>('[data-help-opener]');
    target?.focus();
  }, []);

  // Connection state for the offline note and the video.
  useEffect(() => {
    setOnline(navigator.onLine !== false);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // The question mark key opens the panel when nobody is typing. Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey || open) return;
      if (isTyping(document.activeElement)) return;
      e.preventDefault();
      openPanel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close, openPanel]);

  // Load the guide for this screen whenever the panel is open and the screen, request or a retry changes.
  useEffect(() => {
    if (!open) return;
    let live = true;
    const cached = cache.current.get(key);
    if (cached) setView({ phase: 'ready', ...cached });
    else setView({ phase: 'loading' });
    setShowSkeleton(false);
    setSlow(false);
    const skeleton = setTimeout(() => live && setShowSkeleton(true), SKELETON_AFTER_MS);
    const slowTimer = setTimeout(() => live && setSlow(true), SLOW_AFTER_MS);
    load(pathname, request.guide)
      .then((res) => {
        if (!live) return;
        if (res.ok) {
          const entry = { data: res.data, cues: res.cues };
          cache.current.set(key, entry);
          setView({ phase: 'ready', ...entry });
        } else if (!cached) setView({ phase: 'error' });
      })
      .catch(() => {
        if (live && !cached) setView({ phase: 'error' });
      })
      .finally(() => {
        clearTimeout(skeleton);
        clearTimeout(slowTimer);
      });
    return () => {
      live = false;
      clearTimeout(skeleton);
      clearTimeout(slowTimer);
    };
  }, [open, pathname, request.guide, key, load, tick]);

  const api = useMemo<PanelApi>(
    () => ({ available: true, isOpen: open, open: openPanel, close }),
    [open, openPanel, close],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {open ? (
        <HelpPanel
          view={view}
          online={online}
          showSkeleton={showSkeleton}
          slow={slow}
          section={request.section}
          onClose={close}
          onRetry={() => setTick((n) => n + 1)}
          onWatched={onWatched}
        />
      ) : null}
    </Ctx.Provider>
  );
}
