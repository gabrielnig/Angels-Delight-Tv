import type { UpNextTileData } from '@/lib/data/playback';

/** Pastel Up next tiles, right column on desktop and below the details on narrow widths. */
export function UpNextList({ tiles }: { tiles: UpNextTileData[] }) {
  if (tiles.length === 0) return null;
  return (
    <aside className="watch__upnext" aria-labelledby="watch-upnext-title">
      <h2 id="watch-upnext-title" className="watch__upnext-title">
        Up next
      </h2>
      <ul className="watch__tiles">
        {tiles.map((t) => (
          <li key={t.id}>
            <a className="watch__tile" data-tint={t.tint} href={t.href}>
              <span className="watch__tile-title">{t.title}</span>
              <span className="watch__tile-meta">{`${t.tag} · ${t.durationLabel}`}</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
