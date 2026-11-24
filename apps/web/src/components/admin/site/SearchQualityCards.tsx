'use client';

import { useId, useRef, useState } from 'react';
import type { MissDto, SynonymSaveResult } from '@/lib/data/admin/search-admin-types';
import { dayLabel } from '@/lib/admin/synonym-format';
import { Button } from '../Button';
import { TextArea } from '../fields';
import { Card } from '../PageHeader';
import { useToast } from '../Toast';

export interface SearchQualityCardsProps {
  synonyms: string;
  /** Null when the report could not be loaded. */
  misses: MissDto[] | null;
  saveSynonyms: (text: string) => Promise<SynonymSaveResult>;
  /** Fixed clock for tests. */
  now?: Date;
}

type LineError = { line: number; message: string };

/**
 * M45-S08 and M45-S09 in the Discovery tab (S137 states 4 and 5): the synonyms editor with its error lines, and the
 * report of searches that found nothing. The report holds only the words, never a person.
 */
export function SearchQualityCards({ synonyms, misses, saveSynonyms, now }: SearchQualityCardsProps) {
  const toast = useToast();
  const errorsId = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(synonyms);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<LineError[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [today] = useState(() => now ?? new Date());
  const hasProblems = errors.length > 0 || failure !== null;

  async function save() {
    if (busy) return;
    setBusy(true);
    setErrors([]);
    setFailure(null);
    try {
      const result = await saveSynonyms(text);
      if (result.ok) {
        toast.show({ message: 'Synonyms saved.', tone: 'success' });
      } else if (result.errors.length > 0) {
        setErrors(result.errors);
      } else {
        setFailure(result.error ?? 'Could not save. Your text is kept. Try again.');
      }
    } catch {
      setFailure('Could not save. Your text is kept. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function addFor(query: string) {
    setText((current) => `${current.replace(/\s+$/, '')}${current.trim() === '' ? '' : '\n'}${query}, `);
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  return (
    <>
      <Card title="Search synonyms">
        <div className="adm-stack">
          <TextArea
            ref={area}
            label="One group per line"
            hint="Words on a line find the same videos. Up to 8 extras are used per search."
            rows={6}
            spellCheck={false}
            value={text}
            onChange={(event) => setText(event.target.value)}
            {...(hasProblems ? { 'aria-invalid': true, 'aria-describedby': errorsId } : {})}
          />
          {hasProblems ? (
            <div id={errorsId} role="alert" className="adm-field__error">
              {failure ? <p>{failure}</p> : null}
              {errors.length > 0 ? (
                <ul className="ads-lineerrors">
                  {errors.map((error) => (
                    <li key={`${error.line}-${error.message}`}>{`Line ${error.line}: ${error.message}`}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className="ads-actions">
            <Button variant="primary" loading={busy} onClick={() => void save()}>
              Save synonyms
            </Button>
          </div>
        </div>
      </Card>

      <section className="adm-card adm-table-card" aria-labelledby="misses-h">
        <h2 className="adm-h3" id="misses-h">
          Searches with no results
        </h2>
        <p className="adm-muted">
          No names, accounts or IP addresses are kept. Entries are removed after 90 days.
        </p>
        {misses === null ? (
          <p className="adm-field__error" role="alert">
            The report could not be loaded.
          </p>
        ) : misses.length === 0 ? (
          <div className="ads-empty">
            <p className="adm-field__label">No empty searches yet</p>
            <p className="adm-muted">
              When someone searches and finds nothing, the words show here with no name attached.
            </p>
          </div>
        ) : (
          <table className="adm-table adm-table--always">
            <caption className="adm-sr">Searches with no results</caption>
            <thead>
              <tr>
                <th scope="col">Words searched</th>
                <th scope="col" className="adm-num">
                  Times
                </th>
                <th scope="col">Last seen</th>
                <th scope="col">
                  <span className="adm-sr">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {misses.map((miss) => (
                <tr key={miss.query}>
                  <td>{miss.query}</td>
                  <td className="adm-num">{miss.hits}</td>
                  <td className="adm-muted">{dayLabel(new Date(miss.lastSeen), today)}</td>
                  <td className="adm-actions">
                    <Button
                      variant="secondary"
                      aria-label={`Add synonym for ${miss.query}`}
                      onClick={() => addFor(miss.query)}
                    >
                      Add synonym
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
