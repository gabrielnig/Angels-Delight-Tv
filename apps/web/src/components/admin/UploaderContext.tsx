'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createHttpTransport, createSimulatedTransport, createUploader } from '@/lib/uploader';
import type { Lane, NetworkSource, ResumeStore, Uploader } from '@/lib/uploader';

interface UploaderValue {
  uploader: Uploader;
  lanes: Lane[];
  online: boolean;
}

const UploaderContext = createContext<UploaderValue | null>(null);

export function useUploaderState(): UploaderValue {
  const value = useContext(UploaderContext);
  if (!value) throw new Error('useUploaderState needs UploaderProvider');
  return value;
}

export function browserNetwork(): NetworkSource {
  return {
    isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
    subscribe(listener) {
      const up = () => listener(true);
      const down = () => listener(false);
      window.addEventListener('online', up);
      window.addEventListener('offline', down);
      return () => {
        window.removeEventListener('online', up);
        window.removeEventListener('offline', down);
      };
    },
  };
}

/** Remembers upload ids across reloads so picking the same file again resumes it. */
export function localResumeStore(): ResumeStore {
  const key = (fingerprint: string) => `ad.upload.${fingerprint}`;
  return {
    get: (fingerprint) => window.localStorage.getItem(key(fingerprint)) ?? undefined,
    set: (fingerprint, uploadId) => window.localStorage.setItem(key(fingerprint), uploadId),
    delete: (fingerprint) => window.localStorage.removeItem(key(fingerprint)),
  };
}

/**
 * Holds one uploader for the whole admin so uploads keep running while the person moves between
 * pages (the top bar chip reads the same state). `mode` comes from the server: fixture until the
 * upload API is wired.
 */
export function UploaderProvider({ mode, children }: { mode: 'fixture' | 'http'; children: ReactNode }) {
  const uploader = useMemo(
    () =>
      createUploader({
        transport: mode === 'http' ? createHttpTransport() : createSimulatedTransport(),
        network: typeof window === 'undefined' ? undefined : browserNetwork(),
        store: typeof window === 'undefined' ? undefined : localResumeStore(),
      }),
    [mode],
  );
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [online, setOnline] = useState(true);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    // Batch updates to one per animation frame so progress ticks do not flood React.
    const off = uploader.subscribe((next) => {
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        setLanes(uploader.getLanes());
      });
      void next;
    });
    setLanes(uploader.getLanes());
    return () => {
      off();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [uploader]);

  useEffect(() => {
    const net = browserNetwork();
    setOnline(net.isOnline());
    return net.subscribe(setOnline);
  }, []);

  useEffect(() => {
    const active = lanes.some((lane) => ['waiting', 'uploading', 'offline', 'processing'].includes(lane.status));
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [lanes]);

  const value = useMemo(() => ({ uploader, lanes, online }), [uploader, lanes, online]);
  return <UploaderContext.Provider value={value}>{children}</UploaderContext.Provider>;
}

export function summarizeUploads(lanes: Lane[]) {
  const active = lanes.filter((l) => ['waiting', 'uploading', 'offline', 'processing', 'paused'].includes(l.status));
  const size = active.reduce((sum, l) => sum + l.size, 0);
  const sent = active.reduce((sum, l) => sum + l.bytesUploaded, 0);
  return { count: active.length, percent: size ? Math.floor((sent / size) * 100) : 0 };
}
