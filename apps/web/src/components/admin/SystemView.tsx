'use client';

import { useState } from 'react';
import { formatRelative } from '@/lib/admin/format';
import { STORAGE_LABELS, qualityVerdicts, storageShares } from '@/lib/data/admin/system-rules';
import type { Quality } from '@/lib/data/admin/system-rules';
import type { JobRecord, StorageUsage } from '@/lib/data/admin/types';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { formatBytes } from '@/lib/uploader/format';
import { Badge } from './Badge';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { ProgressBar } from './ProgressBar';
import { TextArea } from './fields';
import { EmptyState } from './states';
import { Tabs } from './Tabs';
import { useCommand } from './useCommand';

export interface SystemActions {
  retry(id: string): Promise<CommandResult>;
  discard(id: string, reason: string): Promise<CommandResult>;
}

const KIND: Record<JobRecord['kind'], string> = {
  encode: 'Encoding',
  captions: 'Captions',
  poster: 'Poster',
  email: 'Email',
  cleanup: 'Cleanup',
};
const ms = (v: number | null) => (v === null ? 'No data yet' : `${(v / 1000).toFixed(1)} s`);

export function SystemView({
  jobs,
  storage,
  quality,
  now,
  canAct,
  showJobs = true,
  actions,
}: {
  jobs: JobRecord[];
  storage: StorageUsage[];
  quality: Quality;
  now: number;
  canAct: boolean;
  /** Failed jobs are for a Super admin (M30-S03). An admin sees Storage and Player quality. */
  showJobs?: boolean;
  actions: SystemActions;
}) {
  const { run, busy } = useCommand();
  const [tab, setTab] = useState(showJobs ? 'jobs' : 'storage');
  const [discarding, setDiscarding] = useState<JobRecord | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const shares = storageShares(storage);
  const total = storage.reduce((n, u) => n + u.bytes, 0);
  const verdicts = qualityVerdicts(quality);
  const close = () => {
    setDiscarding(null);
    setReason('');
    setError(undefined);
  };

  return (
    <Tabs
      label="System"
      value={tab}
      onChange={setTab}
      tabs={[
        ...(showJobs ? [{ id: 'jobs', label: 'Jobs', count: jobs.length }] : []),
        { id: 'storage', label: 'Storage' },
        { id: 'quality', label: 'Player quality' },
      ]}
    >
      {tab === 'jobs' ? (
        jobs.length === 0 ? (
          <EmptyState
            title="No failed jobs."
            help="Background work is running normally."
            icon="check"
          />
        ) : (
          <div className="adm-card adm-table-card">
            <table className="adm-table" style={{ display: 'table' }}>
              <caption className="adm-sr">Failed and dead background jobs</caption>
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">State</th>
                  <th scope="col">What went wrong</th>
                  <th scope="col">When</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <th scope="row">
                      {KIND[j.kind]}: {j.subject}
                    </th>
                    <td>
                      <Badge tone={j.state === 'dead' ? 'danger' : 'warning'} icon="alert">
                        {j.state === 'dead' ? 'Gave up' : 'Failed, will retry'}
                      </Badge>{' '}
                      <span className="adm-muted">
                        {j.attempts} of {j.maxAttempts} tries
                      </span>
                    </td>
                    <td>{j.lastError}</td>
                    <td>{formatRelative(j.failedAt, now)}</td>
                    <td>
                      <span className="adm-row">
                        <Button
                          icon="retry"
                          disabled={!canAct || busy}
                          aria-label={`Retry ${KIND[j.kind]} for ${j.subject}`}
                          onClick={() => run(() => actions.retry(j.id), 'Job queued again.')}
                        >
                          Retry
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={!canAct || busy}
                          aria-label={`Discard ${KIND[j.kind]} for ${j.subject}`}
                          onClick={() => setDiscarding(j)}
                        >
                          Discard
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : tab === 'storage' ? (
        <div className="adm-card adm-stack">
          <h2 className="adm-h3">Storage used: {formatBytes(total)}</h2>
          <ul className="adm-list">
            {shares.map((s) => (
              <li key={s.type}>
                <span className="adm-listrow__main">
                  <strong>{STORAGE_LABELS[s.type]}</strong>
                  <span className="adm-muted">{s.files.toLocaleString('en-NG')} files</span>
                </span>
                <span className="adm-num">{formatBytes(s.bytes)}</span>
                <div style={{ flexBasis: '100%' }}>
                  <ProgressBar
                    value={s.percent}
                    label={`${STORAGE_LABELS[s.type]} share of storage`}
                    small
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="adm-stack">
          <p className="adm-muted" style={{ margin: 0 }}>
            The last 7 days, measured on viewers' devices.
          </p>
          <div className="adm-tiles">
            <div className="adm-card adm-stack" role="group" aria-label="Typical start time">
              <span className="adm-muted">Typical start time</span>
              <strong className="adm-stat">{ms(quality.startupP50Ms)}</strong>
            </div>
            <div className="adm-card adm-stack" role="group" aria-label="Slow start time">
              <span className="adm-muted">Start time for 1 in 4 viewers</span>
              <strong className="adm-stat">{ms(quality.startupP75Ms)}</strong>
              <Badge
                tone={verdicts.startup.tone}
                icon={
                  verdicts.startup.tone === 'success'
                    ? 'check'
                    : verdicts.startup.tone === 'neutral'
                      ? 'info'
                      : 'alert'
                }
              >
                {verdicts.startup.label}
              </Badge>
            </div>
            <div className="adm-card adm-stack" role="group" aria-label="Stalling">
              <span className="adm-muted">Time spent stalling</span>
              <strong className="adm-stat">{(quality.rebufferRatio * 100).toFixed(1)}%</strong>
              <Badge
                tone={verdicts.rebuffer.tone}
                icon={verdicts.rebuffer.tone === 'success' ? 'check' : 'alert'}
              >
                {verdicts.rebuffer.label}
              </Badge>
            </div>
          </div>
          <section className="adm-card adm-table-card" aria-labelledby="err-h">
            <h2
              className="adm-h3"
              id="err-h"
              style={{ padding: 'var(--space-4) var(--space-4) 0' }}
            >
              Playback errors
            </h2>
            {quality.errorsByCode.length === 0 ? (
              <p className="adm-muted" style={{ padding: 'var(--space-4)' }}>
                No playback errors in this period.
              </p>
            ) : (
              <table className="adm-table" style={{ display: 'table' }}>
                <caption className="adm-sr">Playback errors by code</caption>
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col" className="adm-num">
                      Times
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quality.errorsByCode.map((e) => (
                    <tr key={e.code}>
                      <th scope="row">{e.code}</th>
                      <td className="adm-num">{e.count.toLocaleString('en-NG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
      <Dialog
        open={discarding !== null}
        onClose={close}
        title="Discard this job?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                if (!discarding) return;
                const r = await run(() => actions.discard(discarding.id, reason), 'Job discarded.');
                if (r.ok) close();
                else setError(r.error);
              }}
            >
              Discard job
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          The work will not be tried again.{' '}
          {discarding ? `${KIND[discarding.kind]} for ${discarding.subject}.` : ''}
        </p>
        <TextArea
          label="Reason"
          hint="Kept in the audit log."
          value={reason}
          maxLength={200}
          error={error}
          onChange={(e) => setReason(e.target.value)}
        />
      </Dialog>
    </Tabs>
  );
}
