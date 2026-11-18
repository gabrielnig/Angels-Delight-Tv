import { toneFor } from '@ad/ui';

const TONES = ['sky', 'mint', 'lemon', 'peach', 'lavender'];

/** A round initial on one of the avatar fills. The tone comes from the profile, else from the name. */
export function AcctAvatar({ name, tone }: { name: string; tone?: string }) {
  const letter = Array.from(name.trim())[0]?.toUpperCase() ?? '?';
  const picked = tone && TONES.includes(tone) ? tone : toneFor(name);
  return (
    <span className="acct-avatar" data-tone={picked} aria-hidden="true">
      {letter}
    </span>
  );
}
