import { articleHref } from '@/lib/admin/help-map';
import {
  HELP_ROLE_LABELS,
  splitByRole,
  type HelpPath,
  type HelpRole,
  type Library,
} from '@ad/help';
import Link from 'next/link';
import { Icon } from '../Icon';
import { PageHeader } from '../PageHeader';
import { clock } from './format';
import { HiddenNote } from './HiddenNote';
import { ProgressCard } from './ProgressCard';
import { summarizeProgress, type ProgressRows } from '@/lib/data/admin/help-progress';
import { SearchBox } from './SearchBox';
import { SupportStrip } from './SupportStrip';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A path as the person's role sees it: only the guides they can do, unless they asked for all. */
export function visiblePaths(library: Library, role: HelpRole, showAll: boolean) {
  const all = library.articles;
  const split = splitByRole(all, role, { showAll });
  const ids = new Set(split.visible.map((a) => a.meta.id));
  const paths = library.paths
    .map((p) => {
      const articles = p.articles.filter((a) => ids.has(a.meta.id));
      return {
        ...p,
        articles,
        videoCount: articles.filter((a) => a.meta.video).length,
        readMinutes: articles.reduce((n, a) => n + a.meta.readMinutes, 0),
        watchSeconds: articles.reduce((n, a) => n + (a.meta.watchSeconds ?? 0), 0),
      } satisfies HelpPath;
    })
    .filter((p) => p.articles.length > 0);
  return { paths, higher: split.higher };
}

export function PathStats({
  path,
}: {
  path: Pick<HelpPath, 'articles' | 'readMinutes' | 'videoCount' | 'watchSeconds'>;
}) {
  return (
    <>
      {plural(path.articles.length, 'guide')}, {path.readMinutes} min
      {path.videoCount ? `, ${plural(path.videoCount, 'video')} (${clock(path.watchSeconds)})` : ''}
    </>
  );
}

export function HelpHome({
  library,
  role,
  showAll,
  supportContact,
  progress = {},
}: {
  library: Library;
  role: HelpRole;
  showAll: boolean;
  supportContact: string;
  progress?: ProgressRows;
}) {
  const { paths, higher } = visiblePaths(library, role, showAll);
  const ids = paths.flatMap((p) => p.articles);
  const summary = summarizeProgress(progress, {
    guides: ids.map((a) => a.meta.id),
    videos: ids.filter((a) => a.meta.video).map((a) => a.meta.id),
  });
  const start = paths.find((p) => p.key === 'start');
  const others = paths.filter((p) => p.key !== 'start');
  return (
    <div className="hlp-home">
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Help centre' }]}
        title="Help centre"
        lead="Short guides and videos for running the site."
      />
      <HiddenNote
        higher={higher}
        showAll={showAll}
        baseHref="/admin/help"
        roleLabel={HELP_ROLE_LABELS[role]}
      />
      <SearchBox
        action="/admin/help/search"
        label="Search the help centre"
        placeholder="For example: poster, captions, go live"
      />
      {start ? (
        <section className="hlp-start" aria-labelledby="hlp-start-title">
          <p className="hlp-eyebrow">
            <Icon name="star" size={16} /> <PathStats path={start} />
          </p>
          <h2 id="hlp-start-title">{start.title}</h2>
          <p>{start.lead}</p>
          <ol className="hlp-start__list">
            {start.articles.map((a, i) => (
              <li key={a.meta.id}>
                <Link href={articleHref(a.meta.id)}>
                  <span className="hlp-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="hlp-start__title">{a.meta.title}</span>
                  <span className="hlp-start__time">{a.meta.readMinutes} min</span>
                </Link>
              </li>
            ))}
          </ol>
          <Link href={articleHref(start.articles[0]!.meta.id)} className="adm-btn adm-btn--primary">
            Start with guide 1
          </Link>
        </section>
      ) : null}
      {ids.length ? <ProgressCard summary={summary} /> : null}
      {others.length ? (
        <section className="hlp-paths" aria-labelledby="hlp-paths-title">
          <h2 id="hlp-paths-title">Learning paths</h2>
          <p className="adm-lead">
            Pick one. Each is a short list of guides in the order to learn them.
          </p>
          <ul className="hlp-cards">
            {others.map((p) => (
              <li key={p.key}>
                <Link href={`/admin/help/path/${p.key}`} className="hlp-card">
                  <span className="hlp-card__title">{p.title}</span>
                  <span className="hlp-card__lead">{p.lead}</span>
                  <span className="hlp-card__stats">
                    <PathStats path={p} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!paths.length ? (
        <div className="adm-empty" role="status">
          <Icon name="book" size={48} />
          <h2 className="adm-empty__title">No guides yet.</h2>
          <p className="adm-empty__help">New guides appear here as they are written.</p>
        </div>
      ) : null}
      <p className="hlp-gloss-link">
        <Icon name="book" size={16} /> <Link href="/admin/help/glossary">Words explained</Link>
      </p>
      <SupportStrip contact={supportContact} />
    </div>
  );
}
