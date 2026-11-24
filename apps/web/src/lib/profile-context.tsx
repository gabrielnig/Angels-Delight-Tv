'use client';

import { createContext, useContext, type ReactNode } from 'react';

const ProfileIdContext = createContext<string | null>(null);

/** The active profile id for client code that queues writes (M25-S05). */
export function ProfileIdProvider({ id, children }: { id: string | null; children: ReactNode }) {
  return <ProfileIdContext.Provider value={id}>{children}</ProfileIdContext.Provider>;
}

export const useProfileId = () => useContext(ProfileIdContext);

const ProfileKidsContext = createContext(false);

/** Whether the active profile is a kids profile, so client code can leave out controls kids never get (M44-S19). */
export function ProfileKidsProvider({ kids, children }: { kids: boolean; children: ReactNode }) {
  return <ProfileKidsContext.Provider value={kids}>{children}</ProfileKidsContext.Provider>;
}

export const useProfileKids = () => useContext(ProfileKidsContext);
