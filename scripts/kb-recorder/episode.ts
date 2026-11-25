import type { Locator } from '@playwright/test';
import type { Session } from './session';

/** One captioned step. run() performs the action; the runner pads the step so the caption can be read. */
export interface Step {
  /** Caption text. A step without one is a silent beat. Keep it to one sentence, two lines at most. */
  caption?: string;
  run(s: Session): Promise<void>;
  /** Extra time to hold after the action, on top of the reading time. */
  holdMs?: number;
  /** Takes a numbered, annotated screenshot named after the step once the action is done. */
  shot?: { name: string; marks: Array<{ target: (s: Session) => Locator; label?: string }> };
}

export interface Episode {
  id: string;
  title: string;
  steps: Step[];
}
