'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AccountRole } from '@ad/shared';
import { Icon } from './Icon';
import { isActive, navForRole } from './nav';
import { summarizeUploads, useUploaderState } from './UploaderContext';

export interface ShellProps {
  platformName: string;
  actor: { name: string; role: AccountRole; roleLabel: string };
  counts: { encoding: number; captions: number };
  signOut: () => Promise<void>;
  children: ReactNode;
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** Dark sidebar, top bar and work area. DESIGN-SYSTEM 11.25. */
export function AdminShell({ platformName, actor, counts, signOut, children }: ShellProps) {
  const pathname = usePathname() ?? '/admin';
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const groups = navForRole(actor.role);
  const { lanes, online } = useUploaderState();
  const uploads = summarizeUploads(lanes);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="adm-shell">
      <a className="adm-skip" href="#adm-main">
        Skip to content
      </a>
      <aside className={`adm-side${open ? ' is-open' : ''}`} id="adm-side" aria-label="Admin menu">
        <Link href="/admin" className="adm-brand">
          <span className="adm-brand__mark" aria-hidden="true">
            {platformName.slice(0, 1)}
          </span>
          <span>
            {platformName}
            <small>Admin</small>
          </span>
        </Link>
        <nav className="adm-nav" aria-label="Admin">
          {groups.map((group) => (
            <div className="adm-nav__group" key={group.name}>
              <h2 className="adm-nav__title">{group.name}</h2>
              <ul>
                {group.items.map((item) => {
                  const count = item.countKey ? counts[item.countKey] : 0;
                  return (
                    <li key={item.href}>
                      <Link href={item.href} aria-current={isActive(item, pathname) ? 'page' : undefined}>
                        <Icon name={item.icon} />
                        <span>{item.label}</span>
                        {count > 0 ? (
                          <span className="adm-nav__count">
                            {count}
                            <span className="adm-sr"> need attention</span>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      {open ? <button type="button" className="adm-scrim" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}

      <div className="adm-main">
        <header className="adm-top">
          <button
            ref={menuButton}
            type="button"
            className="adm-btn adm-btn--ghost adm-top__menu"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="adm-side"
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name="menu" />
          </button>
          <form className="adm-search" role="search" action="/admin/videos" method="get">
            <Icon name="search" size={18} />
            <input type="search" name="q" aria-label="Search videos" placeholder="Search videos" autoComplete="off" />
          </form>
          <span className="adm-top__space" />
          {uploads.count > 0 ? (
            <Link href="/admin/videos/upload" className="adm-chip">
              <Icon name="upload" size={16} />
              {uploads.count} uploading, {uploads.percent}%
            </Link>
          ) : null}
          <details className="adm-menu">
            <summary aria-label={`Account menu for ${actor.name}`}>
              <span className="adm-avatar" aria-hidden="true">
                {initials(actor.name)}
              </span>
              <span className="adm-menu__name">{actor.name}</span>
              <Icon name="down" size={16} />
            </summary>
            <div className="adm-menu__panel">
              <p className="adm-menu__role">{actor.roleLabel}</p>
              <Link href="/admin/account">
                <Icon name="user" size={18} /> My account
              </Link>
              <a href="/" target="_blank" rel="noreferrer">
                <Icon name="external" size={18} /> Preview site
              </a>
              <form action={signOut}>
                <button type="submit">
                  <Icon name="logout" size={18} /> Sign out
                </button>
              </form>
            </div>
          </details>
        </header>
        {!online ? (
          <div className="adm-offline" role="status">
            <Icon name="alert" size={18} /> You are offline. Uploads will continue when you are back online.
          </div>
        ) : null}
        <main id="adm-main" className="adm-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
