import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Crumb } from './nav';

export function PageHeader({ crumbs, title, lead, actions }: { crumbs: Crumb[]; title: string; lead?: string; actions?: ReactNode }) {
  return (
    <header className="adm-pagehead">
      <nav aria-label="Breadcrumb" className="adm-crumbs">
        <ol>
          {crumbs.map((crumb, index) => (
            <li key={`${crumb.label}-${index}`}>
              {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
            </li>
          ))}
        </ol>
      </nav>
      <div className="adm-pagehead__row">
        <div>
          <h1 className="adm-h1">{title}</h1>
          {lead ? <p className="adm-lead">{lead}</p> : null}
        </div>
        {actions ? <div className="adm-pagehead__actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Card({ title, aside, children, className }: { title?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`adm-card${className ? ` ${className}` : ''}`}>
      {title || aside ? (
        <div className="adm-card__head">
          {title ? <h2 className="adm-h3">{title}</h2> : <span />}
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}
