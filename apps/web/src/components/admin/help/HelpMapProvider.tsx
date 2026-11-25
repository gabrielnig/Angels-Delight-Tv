'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { HelpScreenMap } from '@/lib/admin/help-map';

const Ctx = createContext<HelpScreenMap>({});

/** Carries the route to article map from the shell to the Help links and the panel. */
export function HelpMapProvider({ map, children }: { map: HelpScreenMap; children: ReactNode }) {
  return <Ctx.Provider value={map}>{children}</Ctx.Provider>;
}

export const useHelpMap = (): HelpScreenMap => useContext(Ctx);
