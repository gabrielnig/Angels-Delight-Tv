'use client';

import { useId, useState } from 'react';
import { AcctIcon } from '../account/icons';

export interface HelpArticle {
  id: string;
  question: string;
  answer: string;
}

/** Searchable FAQ in the mockup card (S31 states 3 and 4). Each question is a disclosure button. */
export function HelpFaq({
  articles,
  supportEmail,
}: {
  articles: HelpArticle[];
  supportEmail: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const base = useId();
  const searchId = useId();
  const q = query.trim().toLowerCase();
  const shown = q
    ? articles.filter((a) => `${a.question} ${a.answer}`.toLowerCase().includes(q))
    : articles;
  const mailto = `mailto:${supportEmail}`;

  return (
    <div className="acct-help">
      <div className="acct-search">
        <AcctIcon name="search" size={20} />
        <label className="ad-sr-only" htmlFor={searchId}>
          Search help
        </label>
        <input
          id={searchId}
          type="search"
          enterKeyHint="search"
          placeholder="Search help, for example password"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <p className="ad-sr-only" aria-live="polite">
        {`${shown.length} ${shown.length === 1 ? 'result' : 'results'}`}
      </p>
      {shown.length === 0 ? (
        <div className="acct-card" data-gap="2" data-narrow>
          <h2 className="acct-h3">{`No help articles match "${query.trim()}"`}</h2>
          <p className="acct-muted acct-small">
            Check the spelling or try a shorter word. You can also email us.
          </p>
          <div>
            <a className="ad-btn" data-variant="secondary" data-size="md" href={mailto}>
              <span>Email support</span>
            </a>
          </div>
        </div>
      ) : (
        <>
          <ul className="acct-card acct-faq">
            {shown.map((article) => {
              const expanded = open === article.id;
              return (
                <li key={article.id} className="acct-faq__item">
                  <h2 className="acct-faq__q">
                    <button
                      type="button"
                      className="acct-faq__btn"
                      aria-expanded={expanded}
                      aria-controls={`${base}-${article.id}`}
                      onClick={() => setOpen(expanded ? null : article.id)}
                    >
                      <span>{article.question}</span>
                      <AcctIcon name="chevron" size={20} />
                    </button>
                  </h2>
                  <div
                    id={`${base}-${article.id}`}
                    role="region"
                    aria-label={article.question}
                    hidden={!expanded}
                    className="acct-faq__a"
                  >
                    <p className="acct-muted">{article.answer}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="acct-card acct-row acct-stuck" data-wrap>
            <div className="acct-col">
              <span className="acct-stuck__title">Still stuck?</span>
              <span className="acct-muted acct-small">We reply within 2 working days.</span>
            </div>
            <a className="ad-btn" data-variant="primary" data-size="md" href={mailto}>
              <AcctIcon name="mail" size={18} />
              <span>{`Email ${supportEmail}`}</span>
            </a>
          </div>
        </>
      )}
    </div>
  );
}
