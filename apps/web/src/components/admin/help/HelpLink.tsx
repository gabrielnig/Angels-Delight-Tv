'use client';

import { HELP_HOME, helpTargetFor } from '@/lib/admin/help-map';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../Icon';
import { useHelpMap } from './HelpMapProvider';
import { useHelpPanel } from './HelpPanelHost';

/** The Help link in every page header. It opens the article for this screen, or the help centre (M50-S02). */
export function HelpLink({ placement = 'page' }: { placement?: 'page' | 'top' }) {
  const pathname = usePathname();
  const map = useHelpMap();
  const panel = useHelpPanel();
  const onHelp = pathname === HELP_HOME || pathname?.startsWith(`${HELP_HOME}/`);
  if (onHelp && placement === 'page') return null;
  const { href } = helpTargetFor(map, pathname);
  return (
    <Link
      href={href}
      data-help-opener={placement === 'top' ? '' : undefined}
      aria-haspopup={placement === 'top' && panel.available ? 'dialog' : undefined}
      onClick={(e) => {
        // The top bar button opens the panel. Without script, or with a modifier key, it stays a plain link.
        if (placement !== 'top' || !panel.available) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        panel.open();
      }}
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
