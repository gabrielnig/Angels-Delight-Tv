import 'server-only';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { OG_HEIGHT, OG_MAX_BYTES, OG_WIDTH, scrimCss, truncateTitle } from '../../lib/seo/og-image';

export interface OgRenderInput {
  title: string;
  siteName: string;
  freeLine: string;
  poster: Buffer | null;
}

/**
 * The share picture: poster cropped to 1200 by 630, the four stop scrim, the title in the central 80 percent and
 * the site name. Drawn as PNG, then written as JPEG and stepped down in quality until it is under 300 KB.
 */
export async function renderOgJpeg(input: OgRenderInput): Promise<Buffer> {
  const background = input.poster
    ? `data:image/jpeg;base64,${(
        await sharp(input.poster)
          .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toBuffer()
      ).toString('base64')}`
    : null;
  const image = new ImageResponse(
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: OG_WIDTH,
        height: OG_HEIGHT,
        background: '#1f6fb5',
        color: '#ffffff',
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
      <div
        style={{
          position: 'absolute',
          left: 120,
          right: 120,
          top: Math.round(OG_HEIGHT * 0.62),
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.15 }}>
          {truncateTitle(input.title)}
        </div>
        <div style={{ display: 'flex', marginTop: 20, fontSize: 28 }}>
          {input.siteName} {input.freeLine ? ` · ${input.freeLine}` : ''}
        </div>
      </div>
    </div>,
    { width: OG_WIDTH, height: OG_HEIGHT },
  );
  const png = Buffer.from(await image.arrayBuffer());
  let jpeg = png;
  for (const quality of [80, 70, 60, 50, 40, 30]) {
    jpeg = await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpeg.length <= OG_MAX_BYTES) return jpeg;
  }
  return jpeg;
}
