'use client';

import { useT } from '../lib/i18n/provider';
/**
 * The root error page (S139 state 5), used when the app itself fails to start. It carries no theme, no header and
 * no stylesheet: system colours and fonts only, so it always shows. One action (R39): Reload the page.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const msg = useT();
  return (
    <html lang="en">
      <head>
        <meta name="robots" content="noindex,nofollow" />
        <title>{msg('errors.somethingWentWrong')}</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'Canvas',
          color: 'CanvasText',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <main style={{ padding: '2rem', maxWidth: '30rem' }}>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.75rem' }}>
            {msg('errors.somethingWentWrong')}
          </h1>
          <p style={{ margin: '0 0 1.25rem' }}>{msg('errors.thePageCouldNot')}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: '0 1.5rem',
              font: 'inherit',
              fontWeight: 600,
              color: 'ButtonText',
              background: 'ButtonFace',
              border: '2px solid ButtonText',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            {msg('errors.reloadThePage')}
          </button>
          {error.digest ? (
            <p style={{ marginTop: '1.25rem' }}>
              {msg('errors.reference', { digest: error.digest })}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
