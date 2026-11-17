const TILES = ['sky', 'mint', 'lemon', 'peach', 'lavender'] as const;

/** Stand in for a poster until real images exist: a pastel tile with the first letters. */
export function PosterTile({ title, seed = 0, size = 'sm' }: { title: string; seed?: number; size?: 'sm' | 'md' | 'lg' }) {
  const tone = TILES[Math.abs(seed) % TILES.length];
  return (
    <span className={`adm-poster adm-poster--${size}`} style={{ background: `var(--color-tile-${tone})` }} aria-hidden="true">
      {title.trim().slice(0, 2).toUpperCase()}
    </span>
  );
}

export const seedOf = (id: string) => [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
