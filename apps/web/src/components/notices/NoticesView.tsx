'use client';

import { useEffect } from 'react';
import { msg } from '@ad/shared/messages';
import { ButtonLink } from '@ad/ui';
import { useDataSaver } from '../../lib/lowdata/useDataSaver';
import { NoticePanel } from './NoticePanel';
import { useNoticeFeed } from './useNoticeFeed';

const PAGE_SIZE = 20;

/** The /notifications page: the same list as the popover, as a normal page for phones (M44-S11). */
export function NoticesView({ profileId }: { profileId: string }) {
  const saver = useDataSaver(profileId);
  const feed = useNoticeFeed(profileId);
  const { load } = feed;
  useEffect(() => {
    void load(PAGE_SIZE);
  }, [load]);
  return (
    <div className="ad-noticespage">
      <h1 className="web-page__title">{msg('engage.notices.title')}</h1>
      <NoticePanel
        status={feed.status}
        items={feed.items}
        unread={feed.unread}
        dataSaver={saver.on}
        onRetry={() => void feed.load(PAGE_SIZE)}
        onMarkAll={() => void feed.markAll()}
        onOpen={(item) => feed.markOne(item.id)}
        onLoadMore={feed.nextCursor ? () => void feed.load(PAGE_SIZE, feed.nextCursor ?? undefined) : undefined}
        hideTitle
      />
    </div>
  );
}

/** Shown to a Kids profile: the page is not available there (M44-S17 AC1). */
export function NoticesKidsState() {
  return (
    <div className="ad-noticespage ad-notices__state">
      <h1 className="web-page__title">{msg('engage.notices.kidsTitle')}</h1>
      <p>{msg('engage.notices.kidsBody')}</p>
      <ButtonLink href="/profiles?switch=1">{msg('engage.notices.kidsAction')}</ButtonLink>
    </div>
  );
}
