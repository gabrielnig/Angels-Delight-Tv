'use client';

import { useState } from 'react';
import { Button, Modal } from '@ad/ui';
import { msg } from '@ad/shared/messages';
import {
  clearActivityAction,
  loadActivityAction,
  removeActivityAction,
  restoreActivityAction,
} from '../../app/actions';
import { groupActivity } from '../../lib/activity-groups';
import type { ActivityEntry, ActivityPageData } from '../../lib/data';

interface Tab {
  id: string;
  name: string;
}

type Status = 'ready' | 'loading' | 'error';

/** Viewing activity (S174): grouped list, remove with undo, clear all, a tab per profile for a parent. */
export function ActivityView({
  profiles,
  activeId,
  initial,
  now = new Date(),
  load = loadActivityAction,
  remove = removeActivityAction,
  restore = restoreActivityAction,
  clear = clearActivityAction,
}: {
  profiles: Tab[];
  activeId: string;
  initial: ActivityPageData;
  now?: Date;
  load?: (profileId: string, cursor?: string) => Promise<ActivityPageData>;
  remove?: (profileId: string, videoId: string) => Promise<unknown>;
  restore?: (profileId: string, videoId: string) => Promise<unknown>;
  clear?: (profileId: string) => Promise<unknown>;
}) {
  const [active, setActive] = useState(activeId);
  const [items, setItems] = useState<ActivityEntry[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [status, setStatus] = useState<Status>('ready');
  const [problem, setProblem] = useState<string | null>(null);
  const [undo, setUndo] = useState<ActivityEntry | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const activeName = profiles.find((p) => p.id === active)?.name ?? '';
  const sorted = (list: ActivityEntry[]) =>
    [...list].sort((a, b) => b.watchedAt.localeCompare(a.watchedAt));

  async function fetchPage(profileId: string, from: string | undefined, append: boolean) {
    setStatus('loading');
    setProblem(null);
    try {
      const page = await load(profileId, from);
      setItems((current) => (append ? [...current, ...page.items] : page.items));
      setCursor(page.nextCursor);
      setStatus('ready');
    } catch {
      setStatus('error');
      setProblem(msg('account.activity.loadFailed'));
    }
  }

  function pick(id: string) {
    if (id === active) return;
    setActive(id);
    setItems([]);
    setCursor(null);
    setUndo(null);
    setNotice(null);
    void fetchPage(id, undefined, false);
  }

  async function onRemove(entry: ActivityEntry) {
    setItems((current) => current.filter((i) => i.videoId !== entry.videoId));
    setProblem(null);
    setNotice(null);
    try {
      await remove(active, entry.videoId);
      setUndo(entry);
    } catch {
      setItems((current) => sorted([...current, entry]));
      setProblem(msg('account.activity.removeFailed'));
    }
  }

  async function onUndo() {
    if (!undo) return;
    const entry = undo;
    setUndo(null);
    try {
      await restore(active, entry.videoId);
      setItems((current) => sorted([...current, entry]));
    } catch {
      setProblem(msg('account.activity.removeFailed'));
    }
  }

  async function onClear() {
    setBusy(true);
    try {
      await clear(active);
      setItems([]);
      setCursor(null);
      setUndo(null);
      setConfirming(false);
      setNotice(msg('account.activity.clearDone'));
    } catch {
      setConfirming(false);
      setProblem(msg('account.activity.clearFailed'));
    } finally {
      setBusy(false);
    }
  }

  const groups = groupActivity(items, now);

  return (
    <div className="acct-col" data-gap="3">
      {profiles.length > 1 ? (
        <div className="acct-tabs" role="tablist" aria-label={msg('account.activity.tabsLabel')}>
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              className="acct-tab"
              aria-selected={p.id === active}
              onClick={() => pick(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : null}

      {problem ? (
        <p className="acct-notice" data-tone="error" role="alert">
          <span className="acct-notice__text">{problem}</span>
          {status === 'error' ? (
            <Button variant="secondary" onClick={() => void fetchPage(active, undefined, false)}>
              {msg('account.activity.retry')}
            </Button>
          ) : null}
        </p>
      ) : null}
      {notice ? (
        <p className="acct-small" role="status">
          {notice}
        </p>
      ) : null}
      {undo ? (
        <p className="acct-notice" role="status">
          <span className="acct-notice__text">
            {msg('account.activity.removed', { title: undo.title })}
          </span>
          <Button variant="secondary" onClick={() => void onUndo()}>
            {msg('account.activity.undo')}
          </Button>
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="acct-row" data-between data-wrap data-tight>
          <a className="acct-link" href="/account/data">
            {msg('account.activity.download')}
          </a>
          <Button variant="danger-outline" onClick={() => setConfirming(true)}>
            {msg('account.activity.clear')}
          </Button>
        </div>
      ) : null}

      {status === 'loading' && items.length === 0 ? (
        <div className="acct-card" aria-busy="true">
          <p className="acct-muted">…</p>
        </div>
      ) : null}

      {status !== 'loading' && status !== 'error' && items.length === 0 ? (
        <section className="acct-card" data-gap="2">
          <p className="acct-muted">{msg('account.activity.empty')}</p>
          <div>
            <a className="ad-btn" data-variant="primary" data-size="md" href="/browse">
              {msg('account.activity.browse')}
            </a>
          </div>
        </section>
      ) : null}

      {groups.map((group) => (
        <section key={group.label} className="acct-card" data-gap="2" aria-label={group.label}>
          <h2 className="acct-h2">{group.label}</h2>
          <ul className="acct-activity">
            {group.items.map((entry) => (
              <li key={entry.videoId} className="acct-activity__row">
                {entry.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="acct-activity__poster"
                    src={entry.posterUrl}
                    alt={entry.posterAlt ?? ''}
                    loading="lazy"
                  />
                ) : (
                  <span className="acct-activity__poster" aria-hidden="true" />
                )}
                <div className="acct-col acct-activity__text">
                  <a className="acct-activity__title" href={`/watch/${entry.videoId}`}>
                    {entry.title}
                  </a>
                  {entry.seriesTitle ? (
                    <span className="acct-muted acct-small">
                      {entry.episodeLabel
                        ? `${entry.seriesTitle}, ${entry.episodeLabel}`
                        : entry.seriesTitle}
                    </span>
                  ) : null}
                  <div
                    className="acct-activity__bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={entry.progressPct}
                    aria-label={msg('account.activity.progress', { pct: entry.progressPct })}
                  >
                    <span style={{ inlineSize: `${entry.progressPct}%` }} />
                  </div>
                </div>
                <Button
                  variant="secondary"
                  aria-label={msg('account.activity.removeLabel', { title: entry.title })}
                  onClick={() => void onRemove(entry)}
                >
                  {msg('account.activity.remove')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {cursor ? (
        <div>
          <Button
            variant="secondary"
            loading={status === 'loading'}
            onClick={() => void fetchPage(active, cursor, true)}
          >
            {msg('account.activity.more')}
          </Button>
        </div>
      ) : null}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={msg('account.activity.clearTitle', { name: activeName })}
        className="acct-dialog"
        hideClose
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {msg('account.activity.clearCancel')}
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void onClear()}>
              {msg('account.activity.clear')}
            </Button>
          </>
        }
      >
        <p className="acct-muted">{msg('account.activity.clearLead')}</p>
      </Modal>
    </div>
  );
}
