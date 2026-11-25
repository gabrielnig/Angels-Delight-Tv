import { Fragment } from 'react';
import Link from 'next/link';
import {
  buildSearchIndex,
  highlight,
  search,
  HELP_PATHS,
  type HelpRole,
  type Library,
} from '@ad/help';
import { PageHeader } from '../PageHeader';
import { RoleLabel } from './RoleLabel';
import { SearchBox } from './SearchBox';
import { articleHref } from '@/lib/admin/help-map';

function Marked({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlight(text, query).map((s, i) =>
        s.match ? <mark key={i}>{s.text}</mark> : <Fragment key={i}>{s.text}</Fragment>,
      )}
    </>
  );
}

const pathTitle = (key: string) => HELP_PATHS.find((p) => p.key === key)?.title ?? key;

export function SearchView({
  library,
  query,
  role,
  showAll,
}: {
  library: Library;
  query: string;
  role: HelpRole;
  showAll?: boolean;
}) {
  const q = query.trim().slice(0, 120);
  const out = q ? search(buildSearchIndex(library), q, { role }) : null;
  const browse = showAll ? '/admin/help?show=all' : '/admin/help';
  return (
    <div className="hlp-searchpage">
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Help centre', href: '/admin/help' },
          { label: 'Search' },
        ]}
        title="Search the help centre"
      />
      <SearchBox
        action="/admin/help/search"
        label="Search the help centre"
        defaultValue={q}
        placeholder="For example: poster, captions, go live"
      />
      {!out ? (
        <p className="hlp-tip">
          Try a plain word, such as poster, captions or go live. Press / to jump to this box.
        </p>
      ) : out.results.length > 0 ? (
        <>
          <p className="hlp-count" role="status">
            {out.results.length === 1 ? '1 guide found' : `${out.results.length} guides found`}
          </p>
          <ol className="hlp-results" aria-label="Search results">
            {out.results.map((h) => (
              <li key={h.id} className="hlp-result">
                <Link href={articleHref(h.id)} className="hlp-result__title">
                  <Marked text={h.title} query={q} />
                </Link>
                <p className="hlp-result__sum">
                  <Marked text={h.summary} query={q} />
                </p>
                <p className="hlp-result__meta">
                  <span>{pathTitle(h.path)}</span>
                  <RoleLabel needed={h.roleNeeded} person={role} />
                </p>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="adm-empty" role="status">
          <h2 className="adm-empty__title">No guides match &ldquo;{q}&rdquo;.</h2>
          {out.didYouMean ? (
            <p className="adm-empty__help">
              Did you mean{' '}
              <Link href={`/admin/help/search?q=${encodeURIComponent(out.didYouMean)}`}>
                {out.didYouMean}
              </Link>
              ?
            </p>
          ) : null}
          <p className="adm-empty__help">Try fewer words, or a simpler word for the same thing.</p>
          <Link href={browse} className="adm-btn adm-btn--secondary">
            Browse all guides
          </Link>
        </div>
      )}
    </div>
  );
}
