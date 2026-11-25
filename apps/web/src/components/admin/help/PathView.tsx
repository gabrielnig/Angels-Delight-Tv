import { articleHref } from '@/lib/admin/help-map';
import { HELP_ROLE_LABELS, splitByRole, type HelpRole, type Library } from '@ad/help';
import Link from 'next/link';
import { Icon } from '../Icon';
import { PageHeader } from '../PageHeader';
import { clock } from './format';
import { HiddenNote } from './HiddenNote';
import { RoleLabel } from './RoleLabel';

export function PathView({
  library,
  pathKey,
  role,
  showAll,
}: {
  library: Library;
  pathKey: string;
  role: HelpRole;
  showAll: boolean;
}) {
  const path = library.paths.find((p) => p.key === pathKey);
  if (!path) return null;
  const { visible, higher } = splitByRole(path.articles, role, { showAll });
  return (
    <div className="hlp-path">
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Help centre', href: '/admin/help' },
          { label: path.title },
        ]}
        title={path.title}
        lead={path.lead}
      />
      <HiddenNote higher={higher} showAll={showAll} baseHref={`/admin/help/path/${path.key}`} />
      {visible.length ? (
        <ol className="hlp-pathlist adm-card" aria-label="Guides in this path">
          {visible.map((a, i) => {
            const needs = a.meta.needs
              .map((id) => library.byId.get(id))
              .filter((n): n is NonNullable<typeof n> => Boolean(n));
            return (
              <li key={a.meta.id}>
                <span className="hlp-num" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="hlp-pathlist__main">
                  <Link href={articleHref(a.meta.id)} className="hlp-pathlist__title">
                    {a.meta.title}
                  </Link>
                  <p>{a.meta.summary}</p>
                  {needs.length ? (
                    <p className="hlp-pathlist__needs">
                      Read first:{' '}
                      {needs.map((n, j) => (
                        <span key={n.meta.id}>
                          {j ? ', ' : ''}
                          <Link href={articleHref(n.meta.id)}>{n.meta.title}</Link>
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
                <div className="hlp-pathlist__side">
                  <RoleLabel needed={a.meta.role} person={role} />
                  <span>
                    <Icon name="clock" size={16} /> {a.meta.readMinutes} min read
                  </span>
                  {a.meta.watchSeconds ? (
                    <span>
                      <Icon name="video" size={16} /> {clock(a.meta.watchSeconds)} video
                    </span>
                  ) : null}
                  <span className="adm-sr">For {HELP_ROLE_LABELS[a.meta.role]} and above</span>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="adm-empty" role="status">
          <Icon name="book" size={48} />
          <h2 className="adm-empty__title">No guides here yet.</h2>
          <p className="adm-empty__help">New guides appear here as they are written.</p>
        </div>
      )}
    </div>
  );
}
