import { roleCanDo, type Article, type HelpRole, type Inline, type Library } from '@ad/help';
import { HELP_HOME, articleHref } from './help-map';

/** What the Help panel shows for one guide. Plain data, so a server action can hand it to the browser. */
export interface PanelGuide {
  id: string;
  title: string;
  summary: string;
  readMinutes: number;
  watchSeconds?: number;
  /** True when the guide needs a higher role than the person has. It still shows, with a label. */
  higher: boolean;
  href: string;
  steps: { id: string; c: Inline[] }[];
  video?: { id: string; phone: boolean; captions: 'track' | 'burned' };
}

export interface PanelCore {
  id: string;
  title: string;
  href: string;
}

export interface PanelData {
  pathname: string;
  guides: PanelGuide[];
  /** Shown when no guide matches the screen: a short list of starting points. */
  core: PanelCore[];
}

const CORE_LIMIT = 6;

const toGuide = (a: Article, role: HelpRole): PanelGuide => ({
  id: a.meta.id,
  title: a.meta.title,
  summary: a.meta.summary,
  readMinutes: a.meta.readMinutes,
  watchSeconds: a.meta.watchSeconds,
  higher: !roleCanDo(role, a.meta.role),
  href: articleHref(a.meta.id),
  steps: a.steps.map((s) => ({ id: s.id, c: s.c })),
  video: a.meta.video
    ? { id: a.meta.video.id, phone: a.meta.video.phone, captions: a.meta.video.captions }
    : undefined,
});

/**
 * The guides for the screen the person is on, main one first, or the core tasks when none matches (M50-S03). A named
 * guide (from an inline hint) goes first.
 */
export function panelFor(
  library: Library,
  role: HelpRole,
  pathname: string,
  guide?: string,
): PanelData {
  const onHelp = pathname === HELP_HOME || pathname.startsWith(`${HELP_HOME}/`);
  const forScreen = onHelp ? [] : library.forScreen(pathname);
  const named = guide ? library.byId.get(guide) : undefined;
  const found = named ? [named, ...forScreen.filter((a) => a !== named)] : forScreen;
  const core = library.articles
    .filter((a) => (a.meta.path === 'start' || a.meta.path === 'daily') && roleCanDo(role, a.meta.role))
    .slice(0, CORE_LIMIT)
    .map((a) => ({ id: a.meta.id, title: a.meta.title, href: articleHref(a.meta.id) }));
  return { pathname, guides: found.map((a) => toGuide(a, role)), core };
}
