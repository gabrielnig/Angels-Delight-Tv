import { Banner } from '@ad/ui';
import type { LegalPage } from '../../lib/data';

/** Screens 33 and 34. Readable column with a contents list and a draft banner when the text is not final. */
export function LegalView({ page }: { page: LegalPage }) {
  return (
    <article className="web-page web-legal">
      <h1 className="web-page__title">{page.title}</h1>
      <p className="web-legal__meta">{`Last updated ${page.updated}. ${page.readingMinutes} min read.`}</p>
      {page.draft ? (
        <Banner tone="warning" title="Draft">
          This text is being reviewed and may change.
        </Banner>
      ) : null}
      {page.sections.length > 0 ? (
        <nav aria-label="On this page" className="web-legal__toc">
          <ul>
            {page.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.heading}</a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {page.html !== undefined ? (
        // The HTML was cleaned to a small safe tag set when it was saved and again when it was read.
        <div className="web-legal__section" dangerouslySetInnerHTML={{ __html: page.html }} />
      ) : (
        page.sections.map((s) => (
          <section key={s.id} id={s.id} className="web-legal__section">
            <h2>{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        ))
      )}
    </article>
  );
}
