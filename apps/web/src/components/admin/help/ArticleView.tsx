import { articleHref } from '@/lib/admin/help-map';
import { whoCanDo } from '@/lib/admin/help-who';
import { plainText, type Article, type Library } from '@ad/help';
import type { HelpRole } from '@ad/help';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '../Badge';
import { LinkButton } from '../Button';
import { Icon } from '../Icon';
import { PageHeader } from '../PageHeader';
import { clock, minutesLabel, shortDate, truncate } from './format';
import { PrintButton } from './PrintButton';
import { TocDetails } from './TocDetails';
import { Blocks, Inlines } from './render';
import { RoleLabel } from './RoleLabel';

const ROLE_FOR: Record<HelpRole, string> = {
  editor: 'Editor and above',
  admin: 'Admin and above',
  super_admin: 'Super admin only',
};

/** The first screen of an article that has a fixed address, for the Go to this screen button. */
const fixedScreen = (a: Article) => a.meta.screens.find((s) => !s.includes('['));

export function ArticleView({
  library,
  article,
  role,
  video,
}: {
  library: Library;
  article: Article;
  role: HelpRole;
  /** The video block, supplied by the page when the article has one. */
  video?: ReactNode;
}) {
  const { meta } = article;
  const path = library.paths.find((p) => p.key === meta.path);
  const pos = (path?.articles.findIndex((a) => a.meta.id === meta.id) ?? 0) + 1;
  const next = library.nextOf(meta.id);
  const prev = library.prevOf(meta.id);
  const related = meta.related
    .map((id) => library.byId.get(id))
    .filter((a): a is Article => Boolean(a));
  const needs = meta.needs
    .map((id) => library.byId.get(id))
    .filter((a): a is Article => Boolean(a));
  const who = whoCanDo(meta.actions);
  const screen = fixedScreen(article);
  const stamp = meta.verifiedAgainst
    ? `Checked against release ${meta.verifiedAgainst}, updated ${shortDate(meta.updated)}.`
    : `Not yet checked against a release. Updated ${shortDate(meta.updated)}.`;

  const toc: { href: string; label: string }[] = [
    ...(video ? [{ href: '#video', label: 'Watch the video' }] : []),
    { href: '#before-you-start', label: 'Before you start' },
    { href: '#steps', label: 'Steps' },
    ...article.steps.map((s, i) => ({
      href: `#${s.id}`,
      label: `${i + 1}. ${truncate(plainText(s.c), 40)}`,
    })),
    { href: '#what-you-should-see', label: 'What you should see' },
    { href: '#if-something-goes-wrong', label: 'If something goes wrong' },
    ...(related.length ? [{ href: '#related', label: 'Related guides' }] : []),
  ];

  return (
    <div className="hlp-article">
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Help centre', href: '/admin/help' },
          ...(path ? [{ label: path.title, href: `/admin/help/path/${path.key}` }] : []),
          { label: meta.title },
        ]}
        title={meta.title}
        lead={meta.summary}
        actions={
          <>
            {screen ? (
              <LinkButton href={screen} variant="primary" icon="external">
                Go to this screen
              </LinkButton>
            ) : null}
            <PrintButton />
          </>
        }
      />
      <div className="hlp-meta">
        {path ? (
          <Badge tone="info" icon="book">
            {path.title}, guide {pos} of {path.articles.length}
          </Badge>
        ) : null}
        <RoleLabel needed={meta.role} person={role} />
        <span className="hlp-meta__item">
          <Icon name="clock" size={16} /> {minutesLabel(meta.readMinutes)}
        </span>
        {meta.watchSeconds ? (
          <span className="hlp-meta__item">
            <Icon name="video" size={16} /> {clock(meta.watchSeconds)} video
          </span>
        ) : null}
        <span className="hlp-meta__item">Updated {shortDate(meta.updated)}</span>
      </div>
      <div className="hlp-layout">
        <article className="hlp-body" lang="en">
          <section className="hlp-who" aria-label="Who can do this">
            <p className="hlp-who__title">Who can do this</p>
            {who.length ? (
              <ul>
                {who.map((w) => (
                  <li key={w.action}>
                    {w.label}: <strong>{w.roleLabel}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                <strong>{ROLE_FOR[meta.role]}</strong>
              </p>
            )}
            {meta.roleNote ? <p className="hlp-who__note">{meta.roleNote}</p> : null}
          </section>
          {video ? (
            <section id="video" className="hlp-video hlp-noprint" aria-label="Video">
              {video}
            </section>
          ) : null}
          <section id="what-you-will-do" className="hlp-section">
            <h2>What you will do</h2>
            <Blocks blocks={article.what} />
          </section>
          <section id="before-you-start" className="hlp-section">
            <h2>Before you start</h2>
            <Blocks blocks={article.before} />
            {needs.length ? (
              <p className="hlp-needs">
                Read first:{' '}
                {needs.map((n, i) => (
                  <span key={n.meta.id}>
                    {i ? ', ' : ''}
                    <Link href={articleHref(n.meta.id)}>{n.meta.title}</Link>
                  </span>
                ))}
              </p>
            ) : null}
          </section>
          <section id="steps" className="hlp-section">
            <h2>Steps</h2>
            <ol className="hlp-steps" aria-label="Steps">
              {article.steps.map((s) => (
                <li key={s.id} id={s.id}>
                  <Inlines nodes={s.c} />
                  {s.note ? (
                    <span className="hlp-note">
                      <Inlines nodes={s.note} />
                    </span>
                  ) : null}
                  {s.blocks.length ? <Blocks blocks={s.blocks} /> : null}
                </li>
              ))}
            </ol>
          </section>
          <section id="what-you-should-see" className="hlp-section">
            <h2>What you should see</h2>
            <Blocks blocks={article.see} />
          </section>
          <section id="if-something-goes-wrong" className="hlp-section">
            <h2>If something goes wrong</h2>
            <ul className="hlp-trouble">
              {article.trouble.map((t, i) => (
                <li key={i}>
                  <strong>{t.cause}</strong> <Inlines nodes={t.fix} />
                </li>
              ))}
            </ul>
          </section>
          {related.length ? (
            <section id="related" className="hlp-section hlp-noprint">
              <h2>Related guides</h2>
              <ul className="hlp-related">
                {related.map((r) => (
                  <li key={r.meta.id}>
                    <Link href={articleHref(r.meta.id)}>{r.meta.title}</Link>
                    <span>{r.meta.summary}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <nav className="hlp-prevnext hlp-noprint" aria-label="Previous and next guide">
            {prev ? (
              <Link href={articleHref(prev.meta.id)} rel="prev">
                <span>Previous: {prev.meta.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={articleHref(next.meta.id)} rel="next">
                <span>Next: {next.meta.title}</span>
              </Link>
            ) : null}
          </nav>
          <p className="hlp-stamp">
            Help centre, guide {meta.id}. {stamp}
            {meta.video ? ` Watch the video: Help centre, guide ${meta.id}.` : ''}
          </p>
        </article>
        <nav className="hlp-toc hlp-noprint" aria-label="On this page">
          <TocDetails>
            <ul>
              {toc.map((t) => (
                <li key={t.href}>
                  <a href={t.href}>{t.label}</a>
                </li>
              ))}
            </ul>
          </TocDetails>
        </nav>
      </div>
    </div>
  );
}
