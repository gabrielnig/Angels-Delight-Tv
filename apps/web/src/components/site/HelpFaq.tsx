'use client';

import { useId, useState } from 'react';
import { Input } from '@ad/ui';

export interface HelpArticle {
  id: string;
  question: string;
  answer: string;
}

/** Searchable FAQ. Each question is a disclosure button. */
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
  const q = query.trim().toLowerCase();
  const shown = q
    ? articles.filter((a) => `${a.question} ${a.answer}`.toLowerCase().includes(q))
    : articles;

  return (
    <div className="web-faq">
      <Input
        label="Search help"
        type="search"
        enterKeyHint="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p className="web-grid-count" aria-live="polite">
        {`${shown.length} ${shown.length === 1 ? 'result' : 'results'}`}
      </p>
      {shown.length === 0 ? (
        <div className="web-faq__none">
          <h2>No answers found</h2>
          <p>
            Write to us and we will help: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </p>
        </div>
      ) : (
        <ul className="web-faq__list">
          {shown.map((article) => {
            const expanded = open === article.id;
            return (
              <li key={article.id} className="web-faq__item">
                <h2 className="web-faq__q">
                  <button
                    type="button"
                    className="web-faq__btn"
                    aria-expanded={expanded}
                    aria-controls={`${base}-${article.id}`}
                    onClick={() => setOpen(expanded ? null : article.id)}
                  >
                    {article.question}
                  </button>
                </h2>
                <div
                  id={`${base}-${article.id}`}
                  role="region"
                  aria-label={article.question}
                  hidden={!expanded}
                  className="web-faq__a"
                >
                  <p>{article.answer}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
