import type { ReactNode } from 'react';
import { DEFAULT_PLATFORM_NAME } from '@/lib/platform';

/** Dark, distinct from viewer sign in, with an Admin label (SCREEN-ARCHITECTURE 38). */
export function AuthLayout({ title, lead, children, notice }: { title: string; lead?: string; children: ReactNode; notice?: ReactNode }) {
  return (
    <main className="adm-auth">
      <div className="adm-auth__wrap">
        <div className="adm-auth__intro">
          <span className="adm-auth__label">Admin</span>
          <p className="adm-h2" style={{ marginTop: 'var(--space-2)' }}>
            {DEFAULT_PLATFORM_NAME}
          </p>
          <p>Run the channel, one video at a time.</p>
        </div>
        {notice}
        <div className="adm-auth__card">
          <h1 className="adm-h2">{title}</h1>
          {lead ? <p className="adm-muted" style={{ margin: 0 }}>{lead}</p> : null}
          {children}
        </div>
        <p className="adm-auth__note">This area is for approved staff only. Sign in activity is recorded.</p>
      </div>
    </main>
  );
}
