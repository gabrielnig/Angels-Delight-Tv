'use client';

import { createContext, useContext, type ReactNode } from 'react';

const ProfileIdContext = createContext<string | null>(null);

/** The active profile id for client code that queues writes (M25-S05). */
export function ProfileIdProvider({ id, children }: { id: string | null; children: ReactNode }) {
  return <ProfileIdContext.Provider value={id}>{children}</ProfileIdContext.Provider>;
}

export const useProfileId = () => useContext(ProfileIdContext);
