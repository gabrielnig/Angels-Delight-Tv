import type { ReactNode } from 'react';
import { HelpConnectionNote } from '@/components/admin/help/HelpStates';

export default function HelpLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <HelpConnectionNote />
      {children}
    </>
  );
}
