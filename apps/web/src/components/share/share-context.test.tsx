// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShareConfigProvider, useShareSettings } from './share-context';

function Show() {
  const s = useShareSettings();
  return <p>{s ? s.siteName : 'none'}</p>;
}

describe('ShareConfigProvider', () => {
  it('reads none without a provider', () => {
    render(<Show />);
    expect(screen.getByText('none')).toBeInTheDocument();
  });
  it('carries the settings down', () => {
    render(
      <ShareConfigProvider value={{ channels: [], template: '{title}', siteName: 'ADTV' }}>
        <Show />
      </ShareConfigProvider>,
    );
    expect(screen.getByText('ADTV')).toBeInTheDocument();
  });
});
