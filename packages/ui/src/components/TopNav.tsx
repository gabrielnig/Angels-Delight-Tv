'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Avatar } from './Avatar';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { ButtonLink } from './Button';
import { Link } from './Link';
import { Modal } from './Modal';

export interface NavLink {
  label: string;
  href: string;
}

export interface MenuItem {
  label: string;
  href?: string;
  onSelect?: () => void;
  /** `primary` draws the row as the one filled button of the sheet (Sign in). */
  variant?: 'primary';
  /** A row with an on and off state and a help line, such as Kids mode. Phones draw it as a switch. */
  switch?: { checked: boolean; help?: string; label?: string };
}

export interface AccountSheet {
  /** Dialog title: Account for a visitor, the profile name for a signed in viewer. */
  title: string;
  /** Line under the title, such as Adult profile or Kids profile. */
  subtitle?: string;
  closeLabel?: string;
}

const PHONE = '(max-width: 599px)';

export function isCurrentPath(currentPath: string, href: string): boolean {
  if (href === '/') return currentPath === '/';
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function TopNav({
  brand,
  links,
  currentPath,
  profileName,
  profileAvatarId,
  menu,
  searchHref = '/search',
  overHero = false,
  kids = false,
  onExitKids,
  switchHref = '/profiles?switch=1',
  onBack,
  skin = 'default',
  trailing,
  guest = false,
  accountLabel = 'Account menu',
  kidsLabel = 'Kids',
  hasBell = false,
  guestActions,
  profileMenuLabel,
  searchLabel = 'Search',
  sheet,
  skipLabel = 'Skip to main content',
  mainNavLabel = 'Main',
  backLabel = 'Back',
  switchProfileLabel = 'Switch profile',
  exitKidsLabel = 'Exit kids mode',
}: {
  brand: { name: string; href: string; logoUrl?: string };
  links: NavLink[];
  currentPath: string;
  profileName: string;
  /** The profile's illustrated avatar. Without it the first letter is shown. */
  profileAvatarId?: string;
  menu: MenuItem[];
  searchHref?: string;
  overHero?: boolean;
  kids?: boolean;
  onExitKids?: () => void;
  switchHref?: string;
  /** Shows a Back button before the brand on phones, for detail pages. */
  onBack?: () => void;
  /** `soft` sits on the page colour with a search circle and a profile pill that shows the name (S27 to S31). */
  skin?: 'default' | 'soft';
  /** Extra tool shown before the profile menu, such as the language picker. Not shown on a kids profile. */
  trailing?: ReactNode;
  /** A visitor without an account: the last slot is a person icon, not an avatar (L12). The menu holds Sign in and Create account. */
  guest?: boolean;
  accountLabel?: string;
  /** The word beside the logo mark on a Kids bar, so Kids never depends on colour alone. */
  kidsLabel?: string;
  /** A bell is in `trailing`: the name gives way sooner on narrow phones. */
  hasBell?: boolean;
  /** Sign in and Create account buttons for the wide bar. Phones hide them, the account icon carries both. */
  guestActions?: ReactNode;
  /** Accessible name of the profile button, already translated and with the name filled in. */
  profileMenuLabel?: string;
  searchLabel?: string;
  /** Describes the account bottom sheet. Without it the menu is a popover at every width (11.12). */
  sheet?: AccountSheet;
  /** The words below default to English. Pass the translated text from the message catalog. */
  skipLabel?: string;
  /** Accessible name of the main links landmark. */
  mainNavLabel?: string;
  backLabel?: string;
  /** Kids profile menu rows. */
  switchProfileLabel?: string;
  exitKidsLabel?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const sentinelRef = useRef<HTMLSpanElement>(null);

  // The nav turns solid once a 40px sentinel at the page top leaves the viewport (M47-S04).
  // Without IntersectionObserver the nav is solid, the safe default.
  useEffect(() => {
    if (!overHero) return;
    const sentinel = sentinelRef.current;
    if (typeof IntersectionObserver === 'undefined' || !sentinel) {
      setScrolled(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) setScrolled(!last.isIntersecting);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [overHero]);

  // Phones get a bottom sheet, wider screens keep the popover (11.12).
  useEffect(() => {
    if (!sheet || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(PHONE);
    setPhone(query.matches);
    const onChange = (event: MediaQueryListEvent) => setPhone(event.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, [sheet]);
  const asSheet = Boolean(sheet) && phone;

  useEffect(() => {
    if (!open || asSheet) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open, asSheet]);

  function closeMenu() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function closeSheet() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function renderSheetRow(item: MenuItem) {
    if (item.switch) {
      const { checked, help, label } = item.switch;
      return (
        <div className="ad-sheet__switchrow">
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            className="ad-sheet__row"
            onClick={() => {
              item.onSelect?.();
              setOpen(false);
            }}
          >
            <span>{label ?? item.label}</span>
            <span className="ad-sheet__track" aria-hidden="true" />
          </button>
          {help ? <p className="ad-sheet__help">{help}</p> : null}
        </div>
      );
    }
    if (item.variant === 'primary' && item.href)
      return (
        <ButtonLink href={item.href} className="ad-sheet__primary" onClick={() => setOpen(false)}>
          {item.label}
        </ButtonLink>
      );
    if (item.href)
      return (
        <Link href={item.href} className="ad-sheet__row" onClick={() => setOpen(false)}>
          {item.label}
        </Link>
      );
    return (
      <button
        type="button"
        className="ad-sheet__row"
        onClick={() => {
          setOpen(false);
          item.onSelect?.();
        }}
      >
        {item.label}
      </button>
    );
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'ArrowDown'
        ? (index + 1) % items.length
        : (index - 1 + items.length) % items.length;
    event.preventDefault();
    items[next]?.focus();
  }

  // A Kids profile keeps only Switch profile and Exit kids mode (M35-S02).
  const items: MenuItem[] =
    kids && !guest
      ? [
          { label: switchProfileLabel, href: switchHref },
          { label: exitKidsLabel, onSelect: onExitKids },
        ]
      : menu;
  const solid = !overHero || scrolled;

  return (
    <>
      <a className="ad-skip" href="#main">
        {skipLabel}
      </a>
      {overHero ? (
        <span ref={sentinelRef} className="ad-nav__sentinel" data-nav-sentinel aria-hidden="true" />
      ) : null}
      <header
        className="ad-nav"
        data-surface={solid ? 'solid' : 'clear'}
        data-hero={overHero ? 'true' : undefined}
        data-back={onBack ? 'true' : undefined}
        data-skin={skin === 'soft' ? 'soft' : undefined}
        data-bell={hasBell ? 'true' : undefined}
        data-kids={kids ? 'true' : undefined}
        data-guest={guest ? 'true' : undefined}
      >
        <div className="ad-nav__inner">
          {onBack ? (
            <button type="button" className="ad-nav__back" aria-label={backLabel} onClick={onBack}>
              <Icon name="back" size={24} />
            </button>
          ) : null}
          <Link
            href={brand.href}
            className="ad-nav__brand"
            aria-label={kids ? brand.name : `${brand.name}, home`}
          >
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt="" height={32} />
            ) : (
              <span className="ad-nav__logo" aria-hidden="true">
                <Icon name="play" size={16} filled />
              </span>
            )}
            {kids ? null : <span className="ad-nav__name">{brand.name}</span>}
          </Link>
          {kids ? <span className="ad-nav__kids">{kidsLabel}</span> : null}

          {kids ? null : (
            <nav aria-label={mainNavLabel} className="ad-nav__links">
              {links.map((link) => {
                const current = isCurrentPath(currentPath, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="ad-nav__link"
                    aria-current={current ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="ad-nav__tools">
            <Link
              href={searchHref}
              className="ad-iconbtn"
              aria-label={searchLabel}
              data-variant="plain"
            >
              <Icon name="search" size={24} />
            </Link>
            {kids ? null : trailing}
            {guest && guestActions ? <div className="ad-nav__guest">{guestActions}</div> : null}
            <div className="ad-nav__account">
              <button
                ref={triggerRef}
                type="button"
                className="ad-nav__avatar"
                aria-label={
                  guest
                    ? accountLabel
                    : skin === 'soft'
                      ? undefined
                      : (profileMenuLabel ?? `Profile menu, ${profileName}`)
                }
                aria-haspopup={asSheet ? 'dialog' : 'menu'}
                aria-expanded={open}
                data-guest={guest ? 'true' : undefined}
                onClick={() => setOpen((value) => !value)}
              >
                {guest ? (
                  <span className="ad-nav__person" aria-hidden="true">
                    <Icon name="user" size={18} />
                  </span>
                ) : (
                  <Avatar name={profileName} avatarId={profileAvatarId} size={32} />
                )}
                {skin === 'soft' ? (
                  <>
                    <span className="ad-nav__avatar-name">{profileName}</span>
                    <span className="ad-sr-only">, profile menu</span>
                  </>
                ) : null}
              </button>
              {open && !asSheet ? (
                <div
                  ref={menuRef}
                  className="ad-menu"
                  role="menu"
                  aria-label="Profile menu"
                  onKeyDown={onMenuKeyDown}
                >
                  <p className="ad-menu__head" aria-hidden="true">
                    {profileName}
                  </p>
                  {items.map((item) =>
                    item.href ? (
                      <Link
                        key={item.label}
                        href={item.href}
                        role="menuitem"
                        className="ad-menu__item"
                        onClick={() => setOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <button
                        key={item.label}
                        type="button"
                        role="menuitem"
                        className="ad-menu__item"
                        onClick={() => {
                          setOpen(false);
                          item.onSelect?.();
                        }}
                      >
                        {item.label}
                      </button>
                    ),
                  )}
                </div>
              ) : null}
              {sheet ? (
                <Modal
                  open={open && asSheet}
                  onClose={closeSheet}
                  title={sheet.title}
                  closeLabel={sheet.closeLabel}
                  className="ad-sheet"
                >
                  {sheet.subtitle ? <p className="ad-sheet__sub">{sheet.subtitle}</p> : null}
                  <ul className="ad-sheet__list">
                    {items.map((item) => (
                      <li key={item.label}>{renderSheetRow(item)}</li>
                    ))}
                  </ul>
                </Modal>
              ) : null}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

export function BottomTabBar({
  tabs,
  currentPath,
}: {
  tabs: Array<NavLink & { icon: IconName }>;
  currentPath: string;
}) {
  return (
    <nav aria-label="Primary" className="ad-tabbar">
      {tabs.map((tab) => {
        const current = isCurrentPath(currentPath, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="ad-tabbar__item"
            aria-current={current ? 'page' : undefined}
          >
            <Icon name={tab.icon} size={24} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SiteFooter({
  platformName,
  year,
  links,
  className,
  supportEmail,
}: {
  platformName: string;
  year: number;
  links: NavLink[];
  className?: string;
  /** When set the footer shows the support address beside the name and year (S27 to S31). */
  supportEmail?: string;
}) {
  return (
    <footer className={cx('ad-footer', className)}>
      <nav aria-label="Footer" className="ad-footer__links">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="ad-footer__note">
        {supportEmail ? <span className="ad-footer__support">{supportEmail}</span> : null}
        {supportEmail ? `${platformName}, ${year}` : `${platformName} ${year}`}
      </p>
    </footer>
  );
}
