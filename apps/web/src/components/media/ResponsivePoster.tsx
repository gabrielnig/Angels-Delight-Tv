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
}

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
}: ResponsivePosterProps) {
  const sources = buildPosterSources(variants, {
    maxWidth: dataSaver ? DATA_SAVER_POSTER_WIDTH : null,
  });
  const style = { aspectRatio: ratio } as const;
  const classes = ['ad-poster', className].filter(Boolean).join(' ');

  if (!sources) {
    return (
      <div className={`${classes} ad-poster--empty`} style={style} role="img" aria-label={alt} />
    );
  }
  return (
    <div className={classes} style={style}>
      <img
        className="ad-poster__img"
        src={sources.src}
        srcSet={sources.srcSet}
        sizes={sizes}
        width={sources.width}
        height={sources.height}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
      />
    </div>
  );
}
