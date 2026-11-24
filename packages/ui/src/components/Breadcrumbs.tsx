import type { ReactNode } from 'react';

export interface Crumb {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: Crumb[];
  /** Render a link, for example with next/link. Defaults to a plain anchor. */
  renderLink?: (props: { href: string; children: ReactNode }) => ReactNode;
  tone?: 'admin' | 'viewer';
}

/** One breadcrumb trail for admin and viewer. The last item is the current page and never a link. */
export function Breadcrumbs({ items, renderLink, tone = 'admin' }: BreadcrumbsProps) {
  const link = renderLink ?? (({ href, children }) => <a href={href}>{children}</a>);
  return (
    <nav aria-label="Breadcrumb" className={`ad-crumbs ad-crumbs--${tone}`}>
      <ol>
        {items.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`}>
            {crumb.href && index < items.length - 1 ? (
              link({ href: crumb.href, children: crumb.label })
            ) : (
              <span aria-current="page" title={crumb.label}>
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
