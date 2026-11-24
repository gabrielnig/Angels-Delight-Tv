'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { MATURITY_DEFAULT_LABELS, maturityLabel } from '@ad/shared';

const LabelsContext = createContext<readonly string[] | null>(null);

/** The five maturity labels from the `maturity.labels` setting, read on the server and handed to client code (R20). */
export function MaturityLabelsProvider({
  labels,
  children,
}: {
  labels: readonly string[] | null | undefined;
  children: ReactNode;
}) {
  return <LabelsContext.Provider value={labels ?? null}>{children}</LabelsContext.Provider>;
}

export function useMaturityLabels(): string[] {
  const configured = useContext(LabelsContext);
  return MATURITY_DEFAULT_LABELS.map((_, rank) => maturityLabel(rank, configured));
}

export function useMaturityLabel(rank: number): string {
  return maturityLabel(rank, useContext(LabelsContext));
}
