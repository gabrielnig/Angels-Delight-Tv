import 'server-only';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { bestTextColor } from '@ad/theme';
import { OG_HEIGHT, OG_MAX_BYTES, OG_WIDTH, scrimCss, truncateTitle } from '../../lib/seo/og-image';

export interface OgRenderInput {
  kind: 'video' | 'series';
  title: string;
  siteName: string;
  freeLine: string;
  poster: Buffer | null;
  overlay: boolean;
  badge: boolean;
  /** Theme colour behind a missing poster. Any valid hex; the text colour is chosen to be readable on it. */
  accent: string;
}

const DARK_INK = '#0b1220';
const QUALITIES = [80, 70, 60, 50, 40, 30, 22, 15];

/** White or dark text, whichever reads better (at least 4.5 to 1 for the colours that matter) on a theme colour. */
export function inkFor(accent: string): string {
  try {
    return bestTextColor(accent, ['#ffffff', DARK_INK]).color;
  } catch {
    return '#ffffff';
  }
}

function validHex(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#1f2937';
}

/** Stepped quality ladder. Throws when even the lowest rung is over the 300 KB limit, so the caller falls back. */
async function toJpegUnderLimit(png: Buffer): Promise<Buffer> {
  for (const quality of QUALITIES) {
    const jpeg = await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpeg.length <= OG_MAX_BYTES) return jpeg;
  }
  throw new Error('share image cannot be made smaller than the limit');
}

async function cover(image: Buffer): Promise<string> {
  const jpeg = await sharp(image)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 80 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

interface CardOptions {
  background: string | null;
  accent: string;
  scrim: boolean;
  text: { title: string; line: string; ink: string } | null;
  badge: boolean;
}

async function drawCard(options: CardOptions): Promise<Buffer> {
  const { background, accent, scrim, text, badge } = options;
  const image = new ImageResponse(
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: OG_WIDTH,
        height: OG_HEIGHT,
        background: validHex(accent),
        fontFamily: 'sans-serif',
      }}
    >
      {background ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={background}
          width={OG_WIDTH}
          height={OG_HEIGHT}
          style={{ position: 'absolute', top: 0, left: 0 }}
          alt=""
        />
      ) : null}
      {scrim ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: OG_WIDTH,
            height: OG_HEIGHT,
            backgroundImage: scrimCss(),
          }}
        />
      ) : null}
      {badge ? (
        <div
          style={{
            position: 'absolute',
            left: OG_WIDTH / 2 - 60,
            top: Math.round(OG_HEIGHT * 0.38) - 60,
            width: 120,
            height: 120,
            borderRadius: 60,
            background: 'rgba(11, 18, 32, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              marginLeft: 10,
              borderTop: '22px solid transparent',
              borderBottom: '22px solid transparent',
              borderLeft: '36px solid #ffffff',
            }}
          />
        </div>
      ) : null}
      {text ? (
        <div
          style={{
            position: 'absolute',
            left: 120,
            right: 120,
            top: Math.round(OG_HEIGHT * 0.62),
            display: 'flex',
            flexDirection: 'column',
            color: text.ink,
          }}
        >
          <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.15 }}>{text.title}</div>
          {text.line ? (
            <div style={{ display: 'flex', marginTop: 20, fontSize: 28 }}>{text.line}</div>
          ) : null}
        </div>
      ) : null}
    </div>,
    { width: OG_WIDTH, height: OG_HEIGHT },
  );
  return toJpegUnderLimit(Buffer.from(await image.arrayBuffer()));
}

/**
 * The share picture: poster cropped to 1200 by 630, optionally the four stop scrim with the title in the central
 * 80 percent and the site name, and a play badge on videos. Text sits on the scrim, so white keeps 4.5 to 1 even on
 * a white poster; without a poster the theme colour is the background and the ink follows its contrast.
 */
export async function renderOgJpeg(input: OgRenderInput): Promise<Buffer> {
  const background = input.poster ? await cover(input.poster) : null;
  const overPoster = Boolean(background);
  return drawCard({
    background,
    accent: input.accent,
    scrim: input.overlay && overPoster,
    badge: input.badge && input.kind === 'video',
    text: input.overlay
      ? {
          title: truncateTitle(input.title),
          line: `${input.siteName}${input.freeLine ? ` · ${input.freeLine}` : ''}`,
          ink: overPoster ? '#ffffff' : inkFor(input.accent),
        }
      : null,
  });
}

/** The generic platform card: the configured default image (or the theme colour) with the site name. */
export async function renderDefaultCard(input: {
  siteName: string;
  accent: string;
  image: Buffer | null;
}): Promise<Buffer> {
  const background = input.image ? await cover(input.image) : null;
  return drawCard({
    background,
    accent: input.accent,
    scrim: Boolean(background),
    badge: false,
    text: {
      title: truncateTitle(input.siteName),
      line: '',
      ink: background ? '#ffffff' : inkFor(input.accent),
    },
  });
}
