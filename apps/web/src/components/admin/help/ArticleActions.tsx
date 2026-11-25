'use client';

import { useState } from 'react';
import { useSaveQueue } from './retry-save';
import { Button } from '../Button';

type Saved = { ok: boolean };

/**
 * Mark as done (only by button, never by scrolling) and the one tap Was this helpful answer (M50-S25, S26).
 * A failed save keeps the chosen state, says so in a quiet toast and retries when online.
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
  const [thanks, setThanks] = useState(false);
  const { save } = useSaveQueue();

  // The screen keeps what the person chose. A failed save retries by itself and says so in a quiet toast (S198).
  const run = (key: string, task: () => Promise<Saved>, apply: () => void, thanksAfter = false) => {
    apply();
    setThanks(thanksAfter);
    void save(key, task);
  };

  return (
    <section className="hlp-actions hlp-noprint" aria-label="Your progress">
      <Button
        icon={done ? 'check' : undefined}
        aria-pressed={done}
        onClick={() =>
          run(
            `done:${guide}`,
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
              `helpful:${guide}`,
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
              `helpful:${guide}`,
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
    </section>
  );
}
