import { buildPosterSources, type PosterVariant } from '@/lib/media/poster';
import { DATA_SAVER_POSTER_WIDTH } from '@/lib/lowdata/connection';
import './media.css';

export interface ResponsivePosterProps {
  variants: PosterVariant[];
  /** Describes the picture. Include any text printed on it (DESIGN-SYSTEM section on hero images). */
  alt: string;
  /** Shape of the frame. Posters are 16:9 tiles, portrait covers are 2:3. */
  ratio?: '16/9' | '2/3' | '1/1';
  /** Hint for the browser about the rendered width. Defaults suit a row tile. */
  sizes?: string;
  dataSaver?: boolean;
  /** Above the fold image: loads at once and at high priority. Everything else is lazy. */
  priority?: boolean;
  className?: string;
  /**
   * Title for the generated poster shown when there is no picture yet, or none at all. It is a gradient from
   * the theme tokens with the title on it, so a card is never blank.
   */
  fallbackTitle?: string;
  /** Picks the gradient tone, so a video keeps the same colours on every screen. */
  fallbackSeed?: number;
}

const TONES = 5;

const DEFAULT_SIZES = '(min-width: 960px) 25vw, (min-width: 600px) 33vw, 50vw';

/**
 * Picture from pre-sized variants. The frame keeps its ratio before the image arrives, so nothing shifts.
 * With Data saver on, only variants up to 320 px are offered (M25-S03). With no variants it shows a plain
 * placeholder, never a broken image.
 */
export function ResponsivePoster({
  variants,
  alt,
  ratio = '16/9',
  sizes = DEFAULT_SIZES,
  dataSaver = false,
  priority = false,
  className,
  fallbackTitle,
  fallbackSeed = 0,
}: ResponsivePosterProps) {
  const sources = buildPosterSources(variants, {
    maxWidth: dataSaver ? DATA_SAVER_POSTER_WIDTH : null,
  });
  const style = { aspectRatio: ratio } as const;
  const classes = ['ad-poster', className].filter(Boolean).join(' ');

  if (!sources) {
    if (fallbackTitle) {
      return (
        <div
          className={`${classes} ad-poster--generated`}
          style={style}
          role="img"
          aria-label={alt}
          data-tone={Math.abs(Math.trunc(fallbackSeed)) % TONES}
        >
          <span className="ad-poster__title" aria-hidden="true">
            {fallbackTitle}
          </span>
        </div>
      );
    }
    return (
      <div className={`${classes} ad-poster--empty`} style={style} role="img" aria-label={alt} />
    );
  }
  const image = (
    // Posters come from our own pipeline with webp srcSet and exact sizes, next/image adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="ad-poster__img"
      src={sources.fallback?.src ?? sources.src}
      srcSet={sources.fallback?.srcSet ?? sources.srcSet}
      sizes={sizes}
      width={sources.width}
      height={sources.height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
    />
  );
  return (
    <div className={classes} style={style}>
      {sources.fallback || sources.avif ? (
        <picture>
          {sources.avif ? (
            <source type="image/avif" srcSet={sources.avif.srcSet} sizes={sizes} />
          ) : null}
          {sources.fallback ? (
            <source type="image/webp" srcSet={sources.srcSet} sizes={sizes} />
          ) : null}
          {image}
        </picture>
      ) : (
        image
      )}
    </div>
  );
}
