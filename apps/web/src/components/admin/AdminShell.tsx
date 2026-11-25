'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AccountRole } from '@ad/shared';
import { Icon } from './Icon';
import { HelpLink } from './help/HelpLink';
import { HelpPanelHost, type PanelResult } from './help/HelpPanelHost';
import { NoticeBell, type BellNotice } from './NoticeBell';
import { isActive, navForRole } from './nav';
import { summarizeUploads, useUploaderState } from './UploaderContext';

export interface ShellProps {
  platformName: string;
  actor: { name: string; role: AccountRole; roleLabel: string };
  counts: { encoding: number; captions: number };
  signOut: () => Promise<void>;
  /** The bell. Left out when notices could not be loaded, so the shell still works. */
  notices?: { items: BellNotice[]; unread: number; markAllRead: () => Promise<void> };
  /** Loads the Help panel for a screen. Left out, the Help button stays a plain link. */
  help?: {
    load: (pathname: string, guide?: string) => Promise<PanelResult>;
    onWatched: (guide: string) => Promise<{ ok: boolean }>;
  };
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
export function AdminShell({
  platformName,
  actor,
  counts,
  signOut,
  notices,
  help,
  children,
}: ShellProps) {
  const pathname = usePathname() ?? '/admin';
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const groups = navForRole(actor.role);
  const onHelp = pathname === '/admin/help' || pathname.startsWith('/admin/help/');
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

  const shell = (
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
                      <Link
                        href={item.href}
                        aria-current={isActive(item, pathname) ? 'page' : undefined}
                      >
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
        <div className="adm-side__help">
          <Link href="/admin/help" aria-current={onHelp ? 'page' : undefined}>
            <Icon name="help" />
            <span>Help centre</span>
          </Link>
        </div>
      </aside>
      {open ? (
        <button
          type="button"
          className="adm-scrim"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

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
          {onHelp ? null : (
            <form className="adm-search" role="search" action="/admin/videos" method="get">
              <Icon name="search" size={18} />
              <input
                type="search"
                name="q"
                aria-label="Search videos"
                placeholder="Search videos"
                autoComplete="off"
              />
            </form>
          )}
          <span className="adm-top__space" />
          {uploads.count > 0 ? (
            <Link href="/admin/videos/upload" className="adm-chip">
              <Icon name="upload" size={16} />
              {uploads.count} uploading, {uploads.percent}%
            </Link>
          ) : null}
          <HelpLink placement="top" />
          {notices ? <NoticeBell {...notices} /> : null}
          <details className="adm-menu">
            <summary>
              <span className="adm-sr">Account menu for </span>
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
            <Icon name="alert" size={18} /> You are offline. Uploads will continue when you are back
            online.
          </div>
        ) : null}
        <main id="adm-main" className="adm-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
  return help ? <HelpPanelHost {...help}>{shell}</HelpPanelHost> : shell;
}
