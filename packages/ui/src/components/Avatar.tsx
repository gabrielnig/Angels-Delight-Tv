import { Badge } from './Badge';
import { Icon } from './Icon';
import { cx } from './cx';
import { Link } from './Link';

export const AVATAR_TONES = ['sky', 'mint', 'lemon', 'peach', 'lavender'] as const;
export type AvatarTone = (typeof AVATAR_TONES)[number];
export type AvatarSize = 32 | 40 | 64 | 120 | 160;

export function toneFor(name: string): AvatarTone {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? 'sky';
}

export function Avatar({
  name,
  tone,
  size = 64,
  className,
}: {
  name: string;
  tone?: AvatarTone;
  size?: AvatarSize | number;
  className?: string;
}) {
  const letter = Array.from(name.trim())[0]?.toUpperCase() ?? '?';
  return (
    <span
      className={cx('ad-avatar', className)}
      data-tone={tone ?? toneFor(name)}
      data-size={size}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

export function ProfileTile({
  name,
  tone,
  kids,
  editing,
  href,
  onSelect,
}: {
  name: string;
  tone?: AvatarTone;
  kids?: boolean;
  editing?: boolean;
  /** Renders a link instead of a button, used by manage mode. */
  href?: string;
  onSelect?: () => void;
}) {
  const accessibleName = editing ? `Edit ${name}` : `Switch to ${name}${kids ? ', Kids profile' : ''}`;
  const inner = (
    <>
      <span className="ad-tile__avatar">
        <Avatar name={name} tone={tone} size={120} />
        {editing ? (
          <span className="ad-tile__edit" aria-hidden="true">
            <Icon name="edit" size={24} />
          </span>
        ) : null}
      </span>
      <span className="ad-tile__name" aria-hidden="true">
        {name}
      </span>
      {kids ? (
        <span aria-hidden="true">
          <Badge variant="kids">Kids</Badge>
        </span>
      ) : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="ad-tile" aria-label={accessibleName} data-editing={editing ? 'true' : undefined}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="ad-tile"
      aria-label={accessibleName}
      onClick={onSelect}
      data-editing={editing ? 'true' : undefined}
    >
      {inner}
    </button>
  );
}

export function AddProfileTile({ href }: { href: string }) {
  return (
    <Link href={href} className="ad-tile" aria-label="Add profile">
      <span className="ad-tile__avatar">
        <span className="ad-avatar ad-avatar--add" data-size={120} aria-hidden="true">
          <Icon name="plus" size={48} />
        </span>
      </span>
      <span className="ad-tile__name" aria-hidden="true">
        Add profile
      </span>
    </Link>
  );
}
