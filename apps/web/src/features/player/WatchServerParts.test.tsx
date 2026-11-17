import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createFixturePlaybackData } from '@/lib/data/playback.fixture';
import { UpNextList } from './UpNextList';
import { WatchDetails } from './WatchDetails';

async function data(id: string) {
  const r = await createFixturePlaybackData().getWatchData(id, { profileId: 'p', kids: false });
  if (r.status !== 'ok') throw new Error('missing');
  return r.data;
}

describe('WatchDetails', () => {
  it('shows category, duration, title, description and the CC badge with a text alternative', async () => {
    const html = renderToStaticMarkup(<WatchDetails data={await data('v-plants')} />);
    expect(html).toContain('Science Made Simple');
    expect(html).toContain('5:52');
    expect(html).toContain('<h1');
    expect(html).toContain('How Plants Make Their Own Food');
    expect(html).toContain('Captions available');
  });

  it('shows no CC badge without approved captions', async () => {
    expect(renderToStaticMarkup(<WatchDetails data={await data('v-magnets')} />)).not.toContain(
      'Captions available',
    );
  });

  it('shows the series and episode for an episode', async () => {
    expect(renderToStaticMarkup(<WatchDetails data={await data('v-sky')} />)).toContain(
      'Everyday Science, S1 E4',
    );
  });
});

describe('UpNextList', () => {
  it('renders pastel tiles as links', async () => {
    const d = await data('v-plants');
    const html = renderToStaticMarkup(<UpNextList tiles={d.upNext} />);
    expect(html).toContain('Up next');
    expect(html).toContain('data-tint="sky"');
    expect(html).toContain('href="/watch/v-rain"');
  });

  it('renders nothing when there are no tiles', () => {
    expect(renderToStaticMarkup(<UpNextList tiles={[]} />)).toBe('');
  });
});
