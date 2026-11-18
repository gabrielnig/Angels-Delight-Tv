import { Banner } from '@ad/ui';
import type { LegalPage } from '../../lib/data';
import { LegalToc } from './LegalToc';

/** S31 states 1 and 2. Legal pages get a contents column and a readable article; About gets a headline and cards. */
export function LegalView({ page }: { page: LegalPage }) {
  if (page.slug === 'about' && page.html === undefined) {
    return (
      <article className="acct-about">
        <div className="acct-about__intro">
          <h1 className="acct-about__title">{page.title}</h1>
          {page.lead ? <p className="acct-about__lead">{page.lead}</p> : null}
        </div>
        <div className="acct-about__cards">
          {page.sections.map((s) => (
            <section key={s.id} className="acct-card" data-gap="1">
              <h2 className="acct-h3">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="acct-muted acct-small">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </article>
    );
  }
  return (
    <div className="acct-legal" data-toc={page.sections.length > 0 ? 'true' : undefined}>
      {page.sections.length > 0 ? <LegalToc sections={page.sections} /> : null}
      <article className="acct-legal__article">
        <div>
          <h1 className="acct-legal__title">{page.title}</h1>
          <p className="acct-muted acct-small acct-legal__meta">{`Last updated ${page.updated}. Reading time ${page.readingMinutes} min.`}</p>
        </div>
        {page.draft ? (
          <Banner tone="warning" title="Draft">
            This text is being reviewed and may change.
          </Banner>
        ) : null}
        {page.html !== undefined ? (
          // The HTML was cleaned to a small safe tag set when it was saved and again when it was read.
          <div className="acct-legal__body" dangerouslySetInnerHTML={{ __html: page.html }} />
        ) : (
          page.sections.map((s) => (
            <section key={s.id} id={s.id} className="acct-legal__section">
              <h2 className="acct-h2" data-size="lg">
                {s.heading}
              </h2>
              {s.body.map((p, i) => (
                <p key={i} className="acct-legal__text">
                  {p}
                </p>
              ))}
            </section>
          ))
        )}
      </article>
    </div>
  );
}
