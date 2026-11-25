'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ShareTargetId } from './share-targets';

/** What every Share control on a page needs, read once on the server (D-391). `null` means Share is off here. */
export interface ShareSettings {
  channels: ShareTargetId[];
  /** The share text template, `{title}` and `{siteName}`. */
  template: string;
  siteName: string;
  /** The public origin from APP_ORIGIN. Without it the browser's own origin is used. */
  origin?: string;
}

const ShareSettingsContext = createContext<ShareSettings | null>(null);

export function ShareConfigProvider({
  value,
  children,
}: {
  value: ShareSettings | null;
  children: ReactNode;
}) {
  return <ShareSettingsContext.Provider value={value}>{children}</ShareSettingsContext.Provider>;
}

export const useShareSettings = () => useContext(ShareSettingsContext);
