'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  detectPlatform,
  dismissInstall,
  EMPTY_INSTALL_STATE,
  INSTALL_STORAGE_KEY,
  parseInstallState,
  recordVisit,
  shouldShowInstall,
  type InstallPlatform,
  type InstallState,
} from '@/lib/pwa/install';
import { InAppBrowserNotice, InstallBanner, IosInstructions } from './InstallBanner';
import './pwa.css';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Install banner (S37). Shows once after two visits 3 days apart, and never nags. */
export function InstallPrompt({ platformName }: { platformName: string }) {
  const [state, setState] = useState<InstallState>(EMPTY_INSTALL_STATE);
  const [platform, setPlatform] = useState<InstallPlatform>('none');
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [panel, setPanel] = useState<'none' | 'banner' | 'ios' | 'inapp' | 'added'>('none');

  const persist = useCallback((next: InstallState) => {
    setState(next);
    try {
      localStorage.setItem(INSTALL_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Blocked storage: the banner may reappear next visit.
    }
  }, []);

  useEffect(() => {
    let stored = EMPTY_INSTALL_STATE;
    try {
      stored = parseInstallState(localStorage.getItem(INSTALL_STORAGE_KEY));
    } catch {
      stored = EMPTY_INSTALL_STATE;
    }
    const visited = recordVisit(stored, Date.now());
    persist(visited);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setPanel('added');
      persist({ ...visited, installed: true });
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    setPlatform(detectPlatform({ userAgent: navigator.userAgent, standalone, canPrompt: false }));
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [persist]);

  const effective: InstallPlatform = deferred && platform === 'none' ? 'chromium' : platform;
  useEffect(() => {
    if (panel === 'none' && shouldShowInstall(state, Date.now(), effective)) setPanel('banner');
  }, [state, effective, panel]);

  const dismiss = () => {
    persist(dismissInstall(state, Date.now()));
    setPanel('none');
  };

  if (panel === 'added') {
    return (
      <div className="pwa-toast" role="status">
        Added. Open {platformName} from your Home Screen.
      </div>
    );
  }
  if (panel === 'banner') {
    if (effective === 'chromium') {
      return (
        <InstallBanner
          platformName={platformName}
          onDismiss={dismiss}
          onInstall={async () => {
            if (!deferred) return;
            await deferred.prompt();
            const choice = await deferred.userChoice;
            if (choice.outcome === 'accepted') persist({ ...state, installed: true });
            else persist(dismissInstall(state, Date.now()));
            setDeferred(null);
            setPanel('none');
          }}
        />
      );
    }
    if (effective === 'ios-safari') {
      return (
        <InstallBanner
          platformName={platformName}
          onDismiss={dismiss}
          onInstall={() => setPanel('ios')}
        />
      );
    }
    if (effective === 'ios-other') {
      return (
        <InAppBrowserNotice
          onClose={dismiss}
          onCopy={() =>
            void navigator.clipboard?.writeText(window.location.href).catch(() => undefined)
          }
        />
      );
    }
  }
  if (panel === 'ios')
    return (
      <IosInstructions
        onClose={() => {
          persist(dismissInstall(state, Date.now()));
          setPanel('none');
        }}
      />
    );
  return null;
}
