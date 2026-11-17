import Link from 'next/link';
import type { DashboardData } from '@/lib/data/admin/dashboard';
import { greeting } from '@/lib/data/admin/dashboard';
import { formatBytes } from '@/lib/uploader/format';
import { StatusBadge } from './Badge';
import { LinkButton } from './Button';
import { Chart } from './Chart';
import { Card, PageHeader } from './PageHeader';
import { ProgressBar } from './ProgressBar';
import { RetryButton } from './RetryButton';
import { EmptyState } from './states';

const TILE_LINKS = {
  published: { label: 'Published', href: '/admin/videos?status=published' },
  drafts: { label: 'Drafts', href: '/admin/videos?status=draft' },
  processing: { label: 'Processing', href: '/admin/videos?status=processing' },
  failed: { label: 'Failed', href: '/admin/videos?status=failed' },
} as const;

export function DashboardView({
  data,
  name,
  hour,
}: {
  data: DashboardData;
  name: string;
  hour: number;
}) {
  const upload = (
    <LinkButton href="/admin/videos/upload" variant="accent" icon="upload">
      Upload videos
    </LinkButton>
  );

  if (data.isEmpty) {
    return (
      <>
        <PageHeader crumbs={[{ label: 'Admin' }]} title="Dashboard" actions={upload} />
        <Card title="Start here">
          <p className="adm-muted" style={{ margin: 0 }}>
            Three steps to your first published video.
          </p>
          <ol className="adm-list">
            {[
              ['Upload a video', 'MP4, MOV or MKV. Many at once is fine.'],
              ['Add details and a poster', 'Title, categories and a poster image.'],
              ['Approve captions and publish', 'Then it appears on Home for viewers.'],
            ].map(([title, help], index) => (
              <li key={title}>
                <div className="adm-list__main">
                  <p className="adm-list__title">
                    {index + 1}. {title}
                  </p>
                  <p className="adm-list__sub">{help}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin' }]}
        title="Dashboard"
        lead={greeting(name, hour, data.attention.length)}
        actions={upload}
      />

      <div className="adm-tiles" aria-label="Video counts">
        {(Object.keys(TILE_LINKS) as Array<keyof typeof TILE_LINKS>).map((key) => {
          const tile = data.tiles[key];
          const info = TILE_LINKS[key];
          return (
            <Card key={key} className="adm-tile">
              <span className="adm-tile__label">{info.label}</span>
              {tile.state === 'ready' ? (
                <>
                  <span className="adm-tile__value">{tile.value}</span>
                  <Link className="adm-link" href={info.href}>
                    View list<span className="adm-sr">: {info.label}</span>
                  </Link>
                </>
              ) : (
                <>
                  <p className="adm-muted" style={{ margin: 0 }}>
                    We could not load this number. Your videos are safe.
                  </p>
                  <RetryButton />
                </>
              )}
            </Card>
          );
        })}
      </div>

      <div className="adm-dash-grid">
        <Card
          title="Needs attention"
          aside={<span className="adm-muted">{data.attention.length} items</span>}
        >
          {data.attention.length === 0 ? (
            <EmptyState title="All clear." help="Nothing is waiting on you." icon="check" />
          ) : (
            <ul className="adm-list">
              {data.attention.map((item) => (
                <li key={item.id}>
                  <div className="adm-list__main">
                    <p className="adm-list__title">{item.title}</p>
                    <p className="adm-list__sub">{item.detail}</p>
                  </div>
                  <LinkButton
                    href={item.href}
                    variant={item.kind === 'ready' ? 'primary' : 'secondary'}
                  >
                    {item.actionLabel}
                  </LinkButton>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="adm-stack">
          <Card
            title="Recent uploads"
            aside={
              <Link className="adm-link" href="/admin/videos">
                All videos
              </Link>
            }
          >
            <ul className="adm-list">
              {data.recent.map((item) => (
                <li key={item.id}>
                  <div className="adm-list__main">
                    <Link href={`/admin/videos/${item.id}`} className="adm-list__title">
                      {item.title}
                    </Link>
                    <p className="adm-list__sub">
                      {item.by}, {item.when}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Storage used">
            {data.storage.state === 'ready' ? (
              <>
                <p className="adm-tile__value" style={{ margin: 0 }}>
                  {formatBytes(data.storage.value!.usedBytes)}{' '}
                  <span
                    className="adm-muted"
                    style={{ fontSize: 'var(--text-body)', fontWeight: 'var(--weight-regular)' }}
                  >
                    of {formatBytes(data.storage.value!.capBytes)}
                  </span>
                </p>
                <ProgressBar
                  label="Storage used"
                  value={(data.storage.value!.usedBytes / data.storage.value!.capBytes) * 100}
                />
                <p className="adm-muted" style={{ margin: 0 }}>
                  Originals {formatBytes(data.storage.value!.originalsBytes)}. Streaming sizes{' '}
                  {formatBytes(data.storage.value!.streamingBytes)}. About{' '}
                  {data.storage.value!.monthsLeft} months left at this pace.
                </p>
              </>
            ) : data.storage.state === 'forbidden' ? (
              <p className="adm-muted" style={{ margin: 0 }}>
                Storage is shown to admins. Ask an admin if you need it.
              </p>
            ) : (
              <>
                <p className="adm-muted" style={{ margin: 0 }}>
                  We could not load this number. Your videos are safe.
                </p>
                <RetryButton />
              </>
            )}
          </Card>
        </div>
      </div>

      <Card>
        {data.views.state === 'ready' ? (
          <>
            <Chart
              title="Views, last 7 days"
              noun="views"
              points={data.views.value!.days}
              kind="bar"
            />
            <p className="adm-muted" style={{ margin: 0 }}>
              {data.views.value!.total.toLocaleString('en-NG')} views in total,{' '}
              {data.views.value!.changePercent >= 0 ? 'up' : 'down'}{' '}
              {Math.abs(data.views.value!.changePercent)} percent on the week before.{' '}
              <Link className="adm-link" href="/admin/analytics">
                Open Analytics
              </Link>
            </p>
          </>
        ) : data.views.state === 'forbidden' ? (
          <p className="adm-muted" style={{ margin: 0 }}>
            Views are shown to Analysts and Admins. Ask an Admin if you need them.
          </p>
        ) : (
          <>
            <p className="adm-muted" style={{ margin: 0 }}>
              We could not load views. Your videos are safe.
            </p>
            <RetryButton />
          </>
        )}
      </Card>
    </>
  );
}
