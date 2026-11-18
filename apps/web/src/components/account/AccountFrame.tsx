import type { ReactNode } from 'react';
import { AccountNav } from './AccountNav';

/** Side nav (pill tabs on phones), then the page heading and its cards. Every account screen sits in it. */
export function AccountFrame({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <div className="acct">
      <div className="acct__head">
        <h1 className="acct__title">{title}</h1>
        <p className="acct__lead">{lead}</p>
      </div>
      <aside className="acct__side">
        <AccountNav />
      </aside>
      <div className="acct__main">{children}</div>
    </div>
  );
}
