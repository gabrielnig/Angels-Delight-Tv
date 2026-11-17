import Link from 'next/link';
import type { ChecklistItem } from '@/lib/data/admin/types';
import { Icon } from './Icon';

/** "Before you publish" list. Each row is an icon plus words, never colour alone. */
export function Checklist({ items, compact }: { items: ChecklistItem[]; compact?: boolean }) {
  return (
    <ul className="adm-checklist">
      {items.map((item) => (
        <li key={item.key} className={item.done ? 'is-done' : 'is-open'}>
          <Icon name={item.done ? 'check' : 'alert'} size={18} />
          <div>
            <p className="adm-list__title">
              {item.label}
              <span className="adm-sr">{item.done ? ': done' : ': needs attention'}</span>
            </p>
            {compact && item.done ? null : <p className="adm-list__sub">{item.detail}</p>}
            {!item.done && item.fixHref ? (
              <Link className="adm-link" href={item.fixHref}>
                Fix this<span className="adm-sr">: {item.label}</span>
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
