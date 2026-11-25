'use client';

import { HELP_HOME, helpTargetFor } from '@/lib/admin/help-map';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../Icon';
import { useHelpMap } from './HelpMapProvider';

/** The Help link in every page header. It opens the article for this screen, or the help centre (M50-S02). */
export function HelpLink({ placement = 'page' }: { placement?: 'page' | 'top' }) {
  const pathname = usePathname();
  const map = useHelpMap();
  const onHelp = pathname === HELP_HOME || pathname?.startsWith(`${HELP_HOME}/`);
  if (onHelp && placement === 'page') return null;
  const { href } = helpTargetFor(map, pathname);
  return (
    <Link
      href={href}
      className={
        placement === 'top'
          ? 'adm-btn adm-btn--secondary hlp-topbtn'
          : 'adm-btn adm-btn--ghost hlp-headlink'
      }
    >
      <Icon name="help" size={18} />
      <span className={placement === 'top' ? 'hlp-topbtn__text' : undefined}>Help</span>
    </Link>
  );
}
