import type { Locator } from '@playwright/test';
import type { Session } from './session';

export const ROLES = ['none', 'editor', 'admin', 'super_admin'] as const;
export type EpisodeRole = (typeof ROLES)[number];

export interface ShotMark {
  target: (s: Session) => Locator;
  label?: string;
  /** `blur` hides the area (a value that must not be read). Default is a numbered highlight. */
  kind?: 'mark' | 'blur';
  /** Draw an arrow from the number to the target. Off by default. */
  arrow?: boolean;
}

export interface ShotSpec {
  /** Short name, becomes part of the file name. Unique inside the episode. */
  name: string;
  /** Alt text for the picture. Default is "Step N: " plus the caption. */
  alt?: string;
  marks: ShotMark[];
  /** A tight crop of one card instead of the whole viewport. */
  crop?: (s: Session) => Locator;
  /** Capture dark when the screen is dark by design (sign in card, preview player). */
  scheme?: 'light' | 'dark';
}

/**
 * One step of a procedure. The caption is burned into the video, is the article step and the transcript line.
 * Keep it to one action and one sentence.
 */
export interface Step {
  caption: string;
  run(s: Session): Promise<void>;
  /** Article only extra text (a tip, a limit). Never burned into the video. */
  note?: string;
  /** Extra time to hold after the action, on top of the reading time. */
  holdMs?: number;
  /** A numbered, annotated screenshot taken once the action is done. */
  shot?: ShotSpec;
  /** Starts a chapter of this name at this step (a WebVTT chapters track). Default: one chapter per step. */
  chapter?: string;
  /** Force the caption position. Default: the recorder picks the side that does not cover the target. */
  captionAt?: 'top' | 'bottom';
}

/**
 * A procedure written once. It yields the video, the screenshots, the article step list and the proof that the
 * steps work. See docs/lanes/L14-build.md, "Writing an episode".
 */
export interface Episode {
  id: string;
  title: string;
  /** The role the procedure is shown as. `none` means signed out (the sign in screens). */
  role: EpisodeRole;
  steps: Step[];
  /** Route patterns the article explains, for example "/admin/videos/[id]". Used by the coverage tests. */
  screens?: string[];
  /** Permission action ids from can.ts the procedure uses. */
  actions?: string[];
  /** Settings registry keys, status values or menu labels covered, for the coverage tests. */
  covers?: { settings?: string[]; statuses?: string[]; nav?: string[] };
  /** Source path prefixes the procedure depends on. `--changed` runs the episode when one of them changed. */
  dependsOn?: string[];
  /** Learning path. Default: from the first letter of the id (S, D, W, C, M, K, T). */
  path?: string;
  /** Profiles to record. Default desktop only. */
  viewports?: Array<'desktop' | 'mobile'>;
  /** The article that follows, shown on the end card: "D03 Upload many videos". */
  next?: string;
  /** Where the sign in helper leaves the session. Default /admin. */
  start?: string;
}

const ID = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

/** Plain problems found in an episode definition. Empty means valid. */
export function validateEpisode(e: Episode): string[] {
  const problems: string[] = [];
  if (!ID.test(e.id)) problems.push(`id "${e.id}" must use letters, numbers and dashes only`);
  if (e.title.trim() === '') problems.push('title is empty');
  if (!(ROLES as readonly string[]).includes(e.role)) problems.push(`unknown role "${e.role}"`);
  if (e.steps.length === 0) problems.push('has no steps');
  const seen = new Set<string>();
  e.steps.forEach((s, i) => {
    if (s.caption.trim() === '') problems.push(`step ${i + 1} has no caption`);
    if (s.shot) {
      if (seen.has(s.shot.name)) problems.push(`shot name "${s.shot.name}" is used twice`);
      seen.add(s.shot.name);
    }
  });
  return problems;
}

/** Who the episode is for, as it reads on the title card: "For Editors". */
export function audienceOf(role: EpisodeRole): string {
  return { none: 'everyone', editor: 'Editors', admin: 'Admins', super_admin: 'Super admins' }[
    role
  ];
}
