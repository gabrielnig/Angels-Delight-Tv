'use client';

import { msg, type Translate } from '@ad/shared/messages';
import { createContext, useContext, type ReactNode } from 'react';

const PlayerTContext = createContext<Translate>(msg);

/**
 * The player translates through a function the host passes in (the `t` prop), so it follows the viewer's
 * language without importing the web app. With no provider it falls back to the English catalog.
 */
export function PlayerTProvider({ t, children }: { t: Translate; children: ReactNode }) {
  return <PlayerTContext.Provider value={t}>{children}</PlayerTContext.Provider>;
}

export function usePlayerT(): Translate {
  return useContext(PlayerTContext);
}
