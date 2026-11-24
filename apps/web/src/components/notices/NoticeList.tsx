'use client';

import { msg } from '@ad/shared/messages';
import { formatNoticeTime } from './notice-format';
import type { NoticeItem } from './useNoticeFeed';

export interface NoticeListProps {
  items: readonly NoticeItem[];
  /** Called when a row is opened, so the caller can mark it read. Navigation is left to the link. */
  onOpen(item: NoticeItem): void;
  now?: Date;
}

/** The rows of the bell popover and the notifications page. Unread is a dot, a bold title and a spoken word. */
export function NoticeList({ items, onOpen, now }: NoticeListProps) {
  return (
    <ul className="ad-notices__list">
      {items.map((item) => (
        <li key={item.id}>
          <a
            className="ad-notice"
            href={item.href}
            data-unread={item.read ? undefined : 'true'}
            onClick={() => onOpen(item)}
          >
            <span className="ad-notice__dot" aria-hidden="true" />
            <span className="ad-notice__text">
              {item.read ? null : <span className="ad-sr-only">{msg('engage.notices.unreadMark')}</span>}
              <span className="ad-notice__kind">
                {item.kind === 'new_episode'
                  ? msg('engage.notices.kindEpisodes')
                  : msg('engage.notices.kindVideos')}
              </span>
              <span className="ad-notice__title">{item.title}</span>
              {item.body && item.itemCount > 1 ? (
                <span className="ad-notice__body">{item.body}</span>
              ) : null}
              <time className="ad-notice__time" dateTime={item.createdAt}>
                {formatNoticeTime(item.createdAt, now)}
              </time>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
