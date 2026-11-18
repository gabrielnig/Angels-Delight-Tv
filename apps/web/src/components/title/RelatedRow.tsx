import { Icon, formatDuration, spokenLength } from '@ad/ui';
import type { VideoSummary } from '../../lib/data';

const TINTS = ['sky', 'mint', 'lemon', 'peach', 'lavender'] as const;

/** More like this: one card per title, title shown once under the picture, duration badge on it (S18). */
export function RelatedRow({ items }: { items: VideoSummary[] }) {
  if (items.length === 0) return null;
  return (
    <section className="tv-related" aria-labelledby="tv-related-title">
      <h2 id="tv-related-title" className="tv-related__heading">
        More like this
      </h2>
      <ul className="tv-related__list">
        {items.map((item, index) => (
          <li key={item.id} className="tv-related__item">
            <a
              className="tv-related__card"
              href={`/title/${item.slug}`}
            >
              <span className="tv-related__thumb" data-tint={TINTS[index % TINTS.length]}>
                {item.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbnail.src}
                    srcSet={item.thumbnail.srcSet}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <Icon name="play" size={28} filled />
                )}
                <span className="tv-related__badge" aria-hidden="true">
                  {formatDuration(item.durationSeconds)}
                </span>
              </span>
              <span className="tv-related__name">{item.title}</span>
              <span className="ad-sr-only">, {spokenLength(item.durationSeconds)}</span>
              <span className="tv-related__subject">{item.categoryName}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
