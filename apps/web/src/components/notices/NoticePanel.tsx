'use client';

import { msg } from '@ad/shared/messages';
import { Button } from '@ad/ui';
import { NoticeList } from './NoticeList';
import type { FeedStatus, NoticeItem } from './useNoticeFeed';

export interface NoticePanelProps {
  status: FeedStatus;
  items: readonly NoticeItem[];
  unread: number;
  dataSaver: boolean;
  onRetry(): void;
  onMarkAll(): void;
  onOpen(item: NoticeItem): void;
  onLoadMore?: () => void;
  /** The popover shows "See all", the page does not. */
  footer?: React.ReactNode;
  /** The page has its own h1, so the panel heading is left out. */
  hideTitle?: boolean;
}

/** Heading row, states and list shared by the popover and the /notifications page. */
export function NoticePanel(props: NoticePanelProps) {
  const { status, items, unread, dataSaver } = props;
  return (
    <div className="ad-notices" aria-busy={status === 'loading' ? true : undefined}>
      <div className="ad-notices__head">
        {props.hideTitle ? <span /> : <h2 className="ad-notices__title">{msg('engage.notices.title')}</h2>}
        <Button variant="secondary" size="sm" onClick={props.onMarkAll} disabled={unread === 0}>
          {msg('engage.notices.markAll')}
        </Button>
      </div>
      {dataSaver ? <p className="ad-notices__note">{msg('engage.notices.dataSaver')}</p> : null}
      {status === 'loading' || status === 'idle' ? (
        <div className="ad-notices__skeleton" role="status">
          <span className="ad-sr-only">{msg('engage.notices.loading')}</span>
          <span className="ad-skeleton" />
          <span className="ad-skeleton" />
          <span className="ad-skeleton" />
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="ad-notices__state" role="alert">
          <p>{msg('engage.notices.error')}</p>
          <Button variant="secondary" size="sm" onClick={props.onRetry}>
            {msg('engage.notices.retry')}
          </Button>
        </div>
      ) : null}
      {status === 'ready' && items.length === 0 ? (
        <div className="ad-notices__state">
          <p className="ad-notices__empty-title">{msg('engage.notices.emptyTitle')}</p>
          <p>{msg('engage.notices.emptyBody')}</p>
        </div>
      ) : null}
      {status === 'ready' && items.length > 0 ? (
        <NoticeList items={items} onOpen={props.onOpen} />
      ) : null}
      {props.onLoadMore ? (
        <Button variant="secondary" onClick={props.onLoadMore}>
          {msg('engage.notices.more')}
        </Button>
      ) : null}
      {props.footer}
    </div>
  );
}
