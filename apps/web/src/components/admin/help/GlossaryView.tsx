import Link from 'next/link';
import type { HelpRole, Library } from '@ad/help';
import { PageHeader } from '../PageHeader';
import { SearchBox } from './SearchBox';
import { Inlines } from './render';
import { RoleLabel } from './RoleLabel';
import { articleHref } from '@/lib/admin/help-map';

export function GlossaryView({
  library,
  role,
  filter = '',
}: {
  library: Library;
  role: HelpRole;
  filter?: string;
}) {
  const f = filter.trim().toLowerCase();
  const terms = [...library.glossary]
    .sort((a, b) => a.term.localeCompare(b.term))
    .filter(
      (t) =>
        !f ||
        t.term.toLowerCase().includes(f) ||
        t.aliases.some((a) => a.toLowerCase().includes(f)),
    );
  const groups = new Map<string, typeof terms>();
  for (const t of terms) {
    const letter = t.term.charAt(0).toUpperCase();
    groups.set(letter, [...(groups.get(letter) ?? []), t]);
  }
  return (
    <div className="hlp-glossary">
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Help centre', href: '/admin/help' },
          { label: 'Words explained' },
        ]}
        title="Words explained"
        lead="What the terms used in the admin mean, in plain words."
      />
      <SearchBox
        action="/admin/help/glossary"
        label="Filter terms"
        name="q"
        defaultValue={filter}
        button="Filter"
      />
      {terms.length === 0 ? (
        <div className="adm-empty" role="status">
          <h2 className="adm-empty__title">No terms match &ldquo;{filter.trim()}&rdquo;.</h2>
          <Link href="/admin/help/glossary" className="adm-btn adm-btn--secondary">
            Show all terms
          </Link>
        </div>
      ) : (
        <>
          <nav aria-label="Jump to a letter" className="hlp-az">
            {[...groups.keys()].map((l) => (
              <a key={l} href={`#letter-${l}`}>
                {l}
              </a>
            ))}
          </nav>
          {[...groups].map(([letter, list]) => (
            <section key={letter} aria-labelledby={`letter-${letter}`} className="hlp-gloss-group">
              <h2 id={`letter-${letter}`} className="hlp-gloss-letter">
                {letter}
              </h2>
              <ul className="hlp-gloss-list">
                {list.map((t) => (
                  <li key={t.slug} className="hlp-gloss-item">
                    <h3 id={t.slug}>{t.term}</h3>
                    <p>
                      <Inlines nodes={t.definition} />
                    </p>
                    {t.aliases.length > 0 ? (
                      <p className="hlp-gloss-alias">Also called: {t.aliases.join(', ')}</p>
                    ) : null}
                    {t.guides.length > 0 ? (
                      <ul className="hlp-gloss-guides" aria-label={`Guides about ${t.term}`}>
                        {t.guides.map((id) => {
                          const a = library.byId.get(id);
                          return a ? (
                            <li key={id}>
                              <Link href={articleHref(id)}>{a.meta.title}</Link>{' '}
                              <RoleLabel needed={a.meta.role} person={role} />
                            </li>
                          ) : null;
                        })}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
