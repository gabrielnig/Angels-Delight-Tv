import type { ReactNode } from 'react';
import { AppShell } from '../../../../components/Shell';

/** Keeps the header and footer around the page and around its loading, not found and error states (S18). */
export default function TitleLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
