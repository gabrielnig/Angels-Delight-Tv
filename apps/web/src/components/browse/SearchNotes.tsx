import { msg } from '@ad/shared/messages';
import type { ReactNode } from 'react';
import './search-notes.css';

export interface SubjectChip {
  slug: string;
  name: string;
}

/** The sentence with `{query}` replaced by a node, so the changed word can be a link. */
function around(template: string, node: ReactNode): ReactNode[] {
  const [before = '', after = ''] = template.split('{query}');
  return [before, node, after];
}

/**
 * Notes above the search results (M45-S07, S08): which spelling the results are for, a did you mean link when a
 * few results exist, and a Subjects row of category links. The status line is polite and never moves focus (M34-S02).
 */
export function SearchNotes({
  query,
  showingFor,
  didYouMean,
  subjects,
}: {
  query: string;
  showingFor: string | null;
  didYouMean: string | null;
  subjects: SubjectChip[];
}) {
  if (!showingFor && !didYouMean && subjects.length === 0) return null;
  return (
    <div className="search-notes">
      {showingFor ? (
        <p className="search-notes__line" role="status" aria-live="polite">
          <strong>{msg('search.showingFor', { query: showingFor })}</strong>{' '}
          <span>
            {around(
              msg('search.searchInstead', { query: '{query}' }),
              <a key="q" href={`/search?q=${encodeURIComponent(query)}&exact=1`}>
                {query}
              </a>,
            )}
          </span>
        </p>
      ) : null}
      {didYouMean ? (
        <p className="search-notes__line">
          {around(
            msg('search.didYouMean', { query: '{query}' }),
            <a key="d" href={`/search?q=${encodeURIComponent(didYouMean)}`}>
              {didYouMean}
            </a>,
          )}
        </p>
      ) : null}
      {subjects.length > 0 ? <SubjectChips subjects={subjects} /> : null}
    </div>
  );
}

export function SubjectChips({ subjects }: { subjects: SubjectChip[] }) {
  return (
    <nav aria-label={msg('search.subjects')} className="search-notes__chips">
      {subjects.map((subject) => (
        <a key={subject.slug} className="search-notes__chip" href={`/browse/${subject.slug}`}>
          {subject.name}
        </a>
      ))}
    </nav>
  );
}
