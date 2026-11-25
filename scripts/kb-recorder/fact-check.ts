/**
 * The fact checker reads an article the way a new person would: only its step list and the role. It never sees the
 * episode, so an article whose steps cannot be followed (a label that is not on the screen, two actions in one step, a
 * control the role cannot reach) fails here even when the video was recorded fine (plan section 15.3).
 */
import { ROLE_ORDER } from './fact-roles';

export interface ArticleSteps {
  id: string;
  role: string;
  steps: Array<{ n: number; text: string }>;
}

const front = (md: string) => {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(md);
  const get = (key: string) => new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(m?.[1] ?? '')?.[1]?.trim();
  return { id: get('id'), role: get('role'), body: m ? md.slice(m[0].length) : md };
};

/** The numbered steps of the Steps section (between the kb:steps markers when they exist), with notes and pictures left out. */
export function parseArticle(md: string): ArticleSteps {
  const { id, role, body } = front(md);
  if (!id) throw new Error('The article has no id in its front matter');
  if (!role) throw new Error(`Article ${id} has no role in its front matter`);
  const start = body.search(/^## Steps\s*$/m);
  if (start === -1) throw new Error(`Article ${id} has no Steps section`);
  let section = body.slice(start).replace(/^## Steps\s*\n/, '');
  const next = section.search(/^## /m);
  if (next !== -1) section = section.slice(0, next);
  const marked = /<!-- kb:steps [^>]+ -->([\s\S]*?)<!-- \/kb:steps -->/.exec(section);
  if (marked) section = marked[1]!;
  const steps = [...section.matchAll(/^(\d+)\.\s+(.+)$/gm)].map((m) => ({
    n: Number(m[1]),
    text: m[2]!.trim(),
  }));
  return { id, role, steps };
}

/** True when the first step goes to a sign in page, so the check starts signed out like the person does. */
export function startsSignedOut(steps: Array<{ n: number; text: string }>): boolean {
  const first = steps[0] ? interpretStep(steps[0].text) : null;
  return first?.kind === 'goto' && first.path.startsWith('/admin/login');
}

export function roleAllows(runRole: string, articleRole: string): boolean {
  const have = ROLE_ORDER.indexOf(runRole);
  const need = ROLE_ORDER.indexOf(articleRole);
  if (have === -1 || need === -1)
    throw new Error(`Unknown role "${have === -1 ? runRole : articleRole}"`);
  return have >= need;
}

export type Action =
  | { kind: 'menu'; label: string }
  | { kind: 'click'; label: string }
  | { kind: 'type'; label: string; text: string; secret?: 'email' | 'password' | 'code' }
  | { kind: 'goto'; path: string }
  | { kind: 'check'; label: string; on: boolean }
  | { kind: 'select'; label: string; option: string }
  | { kind: 'see'; text: string }
  | { kind: 'scroll'; text: string }
  | { kind: 'manual'; why: string }
  | { kind: 'unclear'; reason: string };

const CLICK = new Set(['click', 'choose', 'open', 'press', 'tap']);
const UNCLEAR_BOLD =
  'Name the control in bold, exactly as it is on the screen, for example **Upload**.';

/** Turns one step sentence into an action a machine can run, or says why it cannot. Labels are the bold words. */
export function interpretStep(text: string): Action {
  const bold = [...text.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]!);
  const quoted = [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  const first = text
    .replace(/^[*"]+/, '')
    .split(/\s+/)[0]!
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  const lower = text.toLowerCase();

  if (
    /\b(and then|then)\b/.test(lower) ||
    /\b(click|choose|press|type|tick)\b[^.]*\*\*[^*]+\*\*[^.]*\band\b[^.]*\b(click|choose|press|type|tick)\b/i.test(
      text,
    )
  ) {
    return {
      kind: 'unclear',
      reason: 'The step has more than one action: write one action per step.',
    };
  }
  if (first === 'drag' || first === 'upload' || /^(choose|click|select) a file\b/i.test(text)) {
    return {
      kind: 'manual',
      why: 'Needs a file from the person, so it is not run by the checker.',
    };
  }
  if (
    first === 'wait' ||
    (first === 'check' && /^check (that|if|the)\b/i.test(text)) ||
    /^you (see|should see)\b/i.test(text)
  ) {
    return bold.length === 1
      ? { kind: 'see', text: bold[0]! }
      : { kind: 'unclear', reason: `Say what to look for with one bold label. ${UNCLEAR_BOLD}` };
  }
  if (first === 'scroll') {
    return bold.length === 1
      ? { kind: 'scroll', text: bold[0]! }
      : { kind: 'unclear', reason: UNCLEAR_BOLD };
  }
  if (first === 'tick' || first === 'untick') {
    return bold.length === 1
      ? { kind: 'check', label: bold[0]!, on: first === 'tick' }
      : { kind: 'unclear', reason: UNCLEAR_BOLD };
  }
  if (first === 'go') {
    return /^go to\b/i.test(text) && quoted.length === 1 && quoted[0]!.startsWith('/')
      ? { kind: 'goto', path: quoted[0]! }
      : {
          kind: 'unclear',
          reason:
            'Say where to go with one path in quotes, for example Go to the sign in page, "/admin/login".',
        };
  }
  if (first === 'type') {
    // The person's own sign in details are never written in an article. The checker uses the demo account of the role.
    const own = /\byour (email|password)\b|\b6 digit code\b/i.exec(text);
    if (quoted.length === 0 && own && bold.length === 1) {
      const kind = /password/i.test(own[0]) ? 'password' : /email/i.test(own[0]) ? 'email' : 'code';
      return { kind: 'type', label: bold[0]!, text: '', secret: kind };
    }
    return quoted.length === 1 && bold.length === 1
      ? { kind: 'type', label: bold[0]!, text: quoted[0]! }
      : {
          kind: 'unclear',
          reason:
            'Put the text to type in quotes and the name of the field in bold, for example Type "Rivers" in the **Title** box.',
        };
  }
  if (first === 'select' && /\bfrom\b/.test(lower)) {
    return bold.length === 2
      ? { kind: 'select', option: bold[0]!, label: bold[1]! }
      : {
          kind: 'unclear',
          reason:
            'Name the option and the list in bold, for example Select **Published** from the **Status** list.',
        };
  }
  if (CLICK.has(first) || first === 'select') {
    if (bold.length !== 1) {
      return {
        kind: 'unclear',
        reason:
          bold.length === 0
            ? UNCLEAR_BOLD
            : `The step names ${bold.length} controls in bold: write one action per step.`,
      };
    }
    return /\bin the side menu\b/i.test(text)
      ? { kind: 'menu', label: bold[0]! }
      : { kind: 'click', label: bold[0]! };
  }
  return {
    kind: 'unclear',
    reason: `The step starts with "${first}". Start with Click, Choose, Type, Tick, Select, Wait, Check or Scroll, and put the control in bold.`,
  };
}
