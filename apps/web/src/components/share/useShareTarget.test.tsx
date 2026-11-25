// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ProfileKidsProvider } from '../../lib/profile-context';
import { ShareConfigProvider, type ShareSettings } from './share-context';
import { useShareTarget } from './useShareTarget';

const settings: ShareSettings = {
  channels: ['whatsapp', 'telegram'],
  template: '{title} on {siteName}',
  siteName: 'ADTV',
  origin: 'https://adtv.example',
};

function Probe({ slug = 'rivers', at }: { slug?: string; at?: () => number | null }) {
  const share = useShareTarget({ kind: 'video', slug, title: 'Rivers', ...(at ? { getStartAt: at } : {}) });
  return (
    <div>
      {share.onShare ? <button onClick={share.onShare}>probe-share</button> : <span>no-share</span>}
      {share.sheet}
    </div>
  );
}

afterEach(cleanup);

describe('useShareTarget (L15a slice 3)', () => {
  it('is off without settings', () => {
    render(<Probe />);
    expect(screen.getByText('no-share')).toBeInTheDocument();
  });

  it('is off on a kids profile even when settings exist', () => {
    render(
      <ProfileKidsProvider kids>
        <ShareConfigProvider value={settings}>
          <Probe />
        </ShareConfigProvider>
      </ProfileKidsProvider>,
    );
    expect(screen.getByText('no-share')).toBeInTheDocument();
  });

  it('is off when the page says sharing is not allowed (Kids mode for a guest)', () => {
    render(
      <ShareConfigProvider value={null}>
        <Probe />
      </ShareConfigProvider>,
    );
    expect(screen.getByText('no-share')).toBeInTheDocument();
  });

  it('opens the sheet with the canonical link, the filled text and the admin channels', async () => {
    const user = userEvent.setup();
    render(
      <ShareConfigProvider value={settings}>
        <Probe />
      </ShareConfigProvider>,
    );
    await user.click(screen.getByText('probe-share'));
    expect(screen.getByLabelText('Link to share')).toHaveValue('https://adtv.example/title/rivers');
    const wa = screen.getByRole('link', { name: /WhatsApp/ });
    expect(decodeURIComponent(wa.getAttribute('href') ?? '')).toContain('Rivers on ADTV https://adtv.example/title/rivers');
    expect(screen.queryByRole('link', { name: /Facebook/ })).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reads the playing time when the sheet opens and offers Start at', async () => {
    const user = userEvent.setup();
    let now = 83.9;
    render(
      <ShareConfigProvider value={settings}>
        <Probe at={() => now} />
      </ShareConfigProvider>,
    );
    now = 95.2;
    await user.click(screen.getByText('probe-share'));
    expect(screen.getByRole('switch', { name: 'Start at 1:35' })).toBeInTheDocument();
  });

  it('does not offer Start at for the first seconds or when no time is known', async () => {
    const user = userEvent.setup();
    render(
      <ShareConfigProvider value={settings}>
        <Probe at={() => 3} />
      </ShareConfigProvider>,
    );
    await user.click(screen.getByText('probe-share'));
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
