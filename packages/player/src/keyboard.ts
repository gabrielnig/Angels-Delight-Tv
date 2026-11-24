export type ShortcutAction =
  | { type: 'toggle-play' }
  | { type: 'seek-by'; seconds: number }
  | { type: 'seek-start' }
  | { type: 'seek-end' }
  | { type: 'seek-fraction'; fraction: number }
  | { type: 'volume-by'; delta: number }
  | { type: 'toggle-mute' }
  | { type: 'toggle-captions' }
  | { type: 'toggle-fullscreen' }
  | { type: 'speed-step'; direction: -1 | 1 }
  | { type: 'next' }
  | { type: 'skip' }
  | { type: 'theatre' }
  | { type: 'help' };

export interface KeyInput {
  key: string;
  code?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: EventTarget | null;
}

export interface ShortcutContext {
  hasNext: boolean;
  /** A skip window is active, so S skips it (M43). */
  hasSkip?: boolean;
  /** The host offers theatre mode, so T toggles it (M43). */
  hasTheatre?: boolean;
}

export function isEditableTarget(target: EventTarget | null | undefined): boolean {
  if (!target || !(target as Element).tagName) return false;
  const el = target as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  const ce = el.getAttribute?.('contenteditable');
  return ce !== null && ce !== undefined && ce !== 'false';
}

/** M08-S08 keyboard map. Returns null for keys the player does not handle. */
export function resolveShortcut(input: KeyInput, ctx: ShortcutContext): ShortcutAction | null {
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  if (isEditableTarget(input.target)) return null;
  const { key, shiftKey, code } = input;

  if (shiftKey && (key === '<' || code === 'Comma')) return { type: 'speed-step', direction: -1 };
  if (shiftKey && (key === '>' || code === 'Period')) return { type: 'speed-step', direction: 1 };

  switch (key) {
    case ' ':
    case 'Spacebar':
    case 'k':
    case 'K':
      return { type: 'toggle-play' };
    case 'ArrowLeft':
      return { type: 'seek-by', seconds: -5 };
    case 'ArrowRight':
      return { type: 'seek-by', seconds: 5 };
    case 'j':
    case 'J':
      return { type: 'seek-by', seconds: -10 };
    case 'l':
    case 'L':
      return { type: 'seek-by', seconds: 10 };
    case 'Home':
      return { type: 'seek-start' };
    case 'End':
      return { type: 'seek-end' };
    case 'ArrowUp':
      return { type: 'volume-by', delta: 0.05 };
    case 'ArrowDown':
      return { type: 'volume-by', delta: -0.05 };
    case 'm':
    case 'M':
      return { type: 'toggle-mute' };
    case 'c':
    case 'C':
      return { type: 'toggle-captions' };
    case 'f':
    case 'F':
      return { type: 'toggle-fullscreen' };
    case 'n':
    case 'N':
      return ctx.hasNext ? { type: 'next' } : null;
    case 's':
    case 'S':
      return ctx.hasSkip ? { type: 'skip' } : null;
    case 't':
    case 'T':
      return ctx.hasTheatre ? { type: 'theatre' } : null;
    case '?':
      return { type: 'help' };
    default:
      break;
  }
  if (/^[0-9]$/.test(key)) return { type: 'seek-fraction', fraction: Number(key) / 10 };
  return null;
}

export interface ShortcutHelpRow {
  keys: string[];
  action: string;
}

/** Rows for the S26 help dialog. */
export const SHORTCUT_HELP: readonly ShortcutHelpRow[] = [
  { keys: ['Space', 'K'], action: 'Play or pause' },
  { keys: ['Left', 'Right'], action: 'Back or forward 5 seconds' },
  { keys: ['J', 'L'], action: 'Back or forward 10 seconds' },
  { keys: ['Up', 'Down'], action: 'Volume up or down' },
  { keys: ['M'], action: 'Mute or unmute' },
  { keys: ['C'], action: 'Captions on or off' },
  { keys: ['F'], action: 'Full screen' },
  { keys: ['0 to 9'], action: 'Jump to 0 to 90 percent' },
  { keys: ['Shift ,', 'Shift .'], action: 'Slower or faster' },
  { keys: ['N'], action: 'Next episode' },
  { keys: ['S'], action: 'Skip intro, recap or credits' },
  { keys: ['T'], action: 'Theatre mode' },
  { keys: ['Esc'], action: 'Close menus or leave full screen' },
  { keys: ['?'], action: 'Open this list' },
];
