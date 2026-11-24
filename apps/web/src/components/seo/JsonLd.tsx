import { serializeJsonLd } from '../../lib/seo/jsonld';

/**
 * Structured data for crawlers (M45-S02). Server rendered, so it costs the browser nothing. A null block (the
 * data could not be built) renders nothing and the page stays valid.
 */
export function JsonLd({ data }: { data: unknown }) {
  const blocks = (Array.isArray(data) ? data : [data]).filter(Boolean);
  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(block) }}
        />
      ))}
    </>
  );
}
