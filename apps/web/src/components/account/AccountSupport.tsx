'use client';

import { createContext, useContext, type ReactNode } from 'react';

const SupportContext = createContext('support@angelsdelight.tv');

/** Lets the route error screen quote the support address the admin configured. */
export function AccountSupportProvider({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  return <SupportContext.Provider value={email}>{children}</SupportContext.Provider>;
}

export const useSupportEmail = () => useContext(SupportContext);
