'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatRatio } from '@ad/theme/client';
import type {
  ActionResult,
  HistoryDto,
  HistoryRowDto,
  VersionDetailDto,
} from '@/lib/data/admin/theme-types';
import { Badge } from '../Badge';
import { Button, LinkButton } from '../Button';
import { ConfirmDialog, Dialog } from '../Dialog';
import { PageHeader } from '../PageHeader';
import { Banner, EmptyState } from '../states';
import { useToast } from '../Toast';
import './theme.css';

type Filter = 'all' | 'published' | 'draft';

export interface HistoryActions {
  load(options: { filter: Filter; beforeVersion?: number }): Promise<ActionResult<HistoryDto>>;
  loadVersion(id: string): Promise<ActionResult<VersionDetailDto>>;
  restore(id: string): Promise<ActionResult<{ version: number }>>;
}

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  }).format(new Date(iso));

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Drafts' },
];

function Strip({ colors }: { colors: string[] }) {
  return (
    <span className="adt-strip" aria-hidden="true">
      {colors.map((color, index) => (
        <span key={`${color}-${index}`} style={{ background: color }} />
      ))}
    </span>
  );
}

export function ThemeHistoryView({
  initial,
  actions,
}: {
  initial: HistoryDto;
  actions: HistoryActions;
}) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<VersionDetailDto | null>(null);
  const [confirm, setConfirm] = useState<HistoryRowDto | VersionDetailDto | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(next: Filter, more = false) {
    setLoading(true);
    setError(null);
    const result = await actions.load({
      filter: next,
      beforeVersion: more ? (data.nextBefore ?? undefined) : undefined,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setFilter(next);
    setData(more ? { ...result.data, items: [...data.items, ...result.data.items] } : result.data);
  }

  async function open(row: HistoryRowDto) {
    const result = await actions.loadVersion(row.id);
    if (result.ok) setDetail(result.data);
    else setError(result.message);
  }

  async function restore() {
    if (!confirm) return;
    setBusy(true);
    const result = await actions.restore(confirm.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setConfirm(null);
      return;
    }
    toast.show({
      message: `Version v${confirm.version} copied into your draft. Nothing changes for viewers until you publish.`,
      tone: 'success',
    });
    setConfirm(null);
    setDetail(null);
    router.push('/admin/theme');
  }

  const empty = data.items.length === 0 && filter === 'all';
  const current = data.items.find((item) => item.isCurrent);

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Theme', href: '/admin/theme' },
          { label: 'History' },
        ]}
        title="Theme history"
        lead="Every saved version of the theme"
        actions={
          <LinkButton href="/admin/theme" icon="left">
            Back to theme
          </LinkButton>
        }
      />

      {error ? (
        <Banner
          tone="danger"
          action={
            <Button variant="secondary" onClick={() => void load(filter)}>
              Try again
            </Button>
          }
        >
          {error}
        </Banner>
      ) : null}

      {empty ? (
        <EmptyState
          title="No saved versions yet"
          help="The first time you save or publish a theme, it appears here."
          icon="theme"
          action={
            <LinkButton href="/admin/theme" variant="primary">
              Go to theme settings
            </LinkButton>
          }
        />
      ) : (
        <>
          <div className="adm-row" role="group" aria-label="Filter versions">
            {FILTERS.map((item) => (
              <Button
                key={item.id}
                variant={filter === item.id ? 'primary' : 'secondary'}
                aria-pressed={filter === item.id}
                onClick={() => void load(item.id)}
              >
                {item.label}
              </Button>
            ))}
            <span
              className="adm-muted"
              role="status"
            >{`Showing ${data.items.length} of ${data.total} versions`}</span>
          </div>

          {data.items.length === 0 ? (
            <EmptyState
              title="No versions match"
              help="Try a different filter."
              icon="theme"
              live
            />
          ) : (
            <table className="adt-hist">
              <caption className="adm-sr">Theme versions, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col">When</th>
                  <th scope="col">By</th>
                  <th scope="col">Colours</th>
                  <th scope="col">Font</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="adm-sr">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{`v${row.version}`}</th>
                    <td>{when(row.at)}</td>
                    <td>{row.by}</td>
                    <td>
                      <Strip colors={row.swatches} />
                    </td>
                    <td>{row.fontLabel}</td>
                    <td>
                      {row.status === 'published' ? (
                        <Badge tone="success" icon="check">
                          Published
                        </Badge>
                      ) : (
                        <Badge tone="neutral" icon="file">
                          Draft
                        </Badge>
                      )}{' '}
                      {row.isCurrent ? <Badge tone="info">Current</Badge> : null}
                      {row.isDraftInProgress ? <Badge tone="warning">In progress</Badge> : null}
                    </td>
                    <td>
                      <div className="adm-row">
                        <Button
                          variant="ghost"
                          onClick={() => void open(row)}
                          aria-label={`View version ${row.version}`}
                        >
                          View
                        </Button>
                        {row.isCurrent || row.isDraftInProgress ? null : (
                          <Button
                            variant="secondary"
                            onClick={() => setConfirm(row)}
                            aria-label={`Restore version ${row.version}`}
                          >
                            Restore
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {data.nextBefore !== null ? (
            <div>
              <Button variant="secondary" loading={loading} onClick={() => void load(filter, true)}>
                Load older versions
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? `Version v${detail.version}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetail(null)}>
              Close
            </Button>
            {detail && !detail.isCurrent && !detail.isDraftInProgress ? (
              <Button variant="primary" onClick={() => setConfirm(detail)}>
                Restore as draft
              </Button>
            ) : null}
          </>
        }
      >
        {detail ? (
          <div className="adt-detail">
            <p>
              {detail.status === 'published' ? 'Published' : 'Draft'}, {when(detail.at)} by{' '}
              {detail.by}
            </p>
            <dl>
              <dt>Colours</dt>
              <dd>
                <Strip colors={detail.swatches} />
              </dd>
              <dt>Primary</dt>
              <dd>{detail.primary}</dd>
              <dt>Font</dt>
              <dd>{detail.fontLabel}</dd>
              <dt>Base size</dt>
              <dd>{`${Math.round(16 * detail.typeScale * 10) / 10} px`}</dd>
              <dt>Contrast</dt>
              <dd>{`${formatRatio(detail.contrast)} ${detail.contrastLevel === 'pass' ? 'Pass' : 'Low'}`}</dd>
            </dl>
            <Banner tone="info">
              Restoring creates a new draft. Nothing changes for viewers until you publish.
            </Banner>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm ? `Restore version v${confirm.version}?` : ''}
        consequence={
          confirm
            ? `This copies v${confirm.version} (${confirm.fontLabel}) into your draft and replaces the draft you have now. ${current ? `Viewers keep seeing v${current.version} until you publish.` : 'Viewers keep seeing the current theme until you publish.'}`
            : ''
        }
        confirmLabel="Restore as draft"
        busy={busy}
        onConfirm={() => void restore()}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
