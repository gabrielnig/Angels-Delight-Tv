'use client';

import { useState, useTransition } from 'react';
import { Button } from '../Button';

type Saved = { ok: boolean };

/**
 * Mark as done (only by button, never by scrolling) and the one tap Was this helpful answer (M50-S25, S26).
 * A failed save keeps the old state and says so.
 */
export function ArticleActions({
  guide,
  initial,
  setDone,
  setHelpful,
}: {
  guide: string;
  initial: { done: boolean; helpful: boolean | null };
  setDone: (guide: string, done: boolean) => Promise<Saved>;
  setHelpful: (guide: string, helpful: boolean) => Promise<Saved>;
}) {
  const [done, setDoneState] = useState(initial.done);
  const [helpful, setHelpfulState] = useState(initial.helpful);
  const [error, setError] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [pending, start] = useTransition();

  const run = (task: () => Promise<Saved>, apply: () => void, thanksAfter = false) =>
    start(async () => {
      setError(false);
      let result: Saved;
      try {
        result = await task();
      } catch {
        result = { ok: false };
      }
      if (!result.ok) return setError(true);
      apply();
      setThanks(thanksAfter);
    });

  return (
    <section className="hlp-actions hlp-noprint" aria-label="Your progress">
      <Button
        icon={done ? 'check' : undefined}
        aria-pressed={done}
        loading={pending}
        onClick={() =>
          run(
            () => setDone(guide, !done),
            () => setDoneState(!done),
          )
        }
      >
        {done ? 'Done. Mark as not done' : 'Mark as done'}
      </Button>
      <div className="hlp-helpful" role="group" aria-label="Was this helpful?">
        <span>Was this helpful?</span>
        <Button
          aria-pressed={helpful === true}
          onClick={() =>
            run(
              () => setHelpful(guide, true),
              () => setHelpfulState(true),
              true,
            )
          }
        >
          Yes
        </Button>
        <Button
          aria-pressed={helpful === false}
          onClick={() =>
            run(
              () => setHelpful(guide, false),
              () => setHelpfulState(false),
              true,
            )
          }
        >
          No
        </Button>
      </div>
      {thanks ? <p role="status">Thanks. Your answer is saved.</p> : null}
      {error ? <p role="alert">We could not save that. Try again.</p> : null}
    </section>
  );
}
