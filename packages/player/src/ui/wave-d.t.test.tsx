// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { msg, type Translate } from '@ad/shared/messages';
import { PlayerController } from '../controller';
import { FakeEngine, FakeMedia, FakeNetwork } from '../testing/fakes';
import { PlayerTProvider } from '../t';
import { seekValueText, spokenTime } from '../format';
import { DEFAULT_CAPTION_STYLE } from '../captionStyle';
import { CaptionAppearance } from './CaptionAppearance';
import { EndScreen } from './EndScreen';
import { PlayerView } from './PlayerView';
import { SeekBar } from './SeekBar';
import { SettingsMenu } from './SettingsMenu';
import { SpeedRows } from './Menus';
import { ShortcutsDialog } from './ShortcutsDialog';

/** A visible stand in for a translated catalog: every string is the English text in brackets. */
const t: Translate = (key, params) => `[${msg(key, params)}]`;
const wrap = (node: React.ReactNode) => <PlayerTProvider t={t}>{node}</PlayerTProvider>;

afterEach(cleanup);

const next = { id: 'v2', title: 'Why the Sky Is Blue', meta: 'Everyday Science, 5 min' };
const endBase = {
  data: {
    backHref: '/s/e',
    homeHref: '/',
    browseHref: '/browse',
    onAddToList: () => {},
    related: [],
  },
  next,
  countdown: null as number | null,
  countdownTotal: 5,
  cancelled: false,
  autoplayNext: true,
  onPlayNext: () => {},
  onCancel: () => {},
  onReplay: () => {},
};

describe('player wave D: end screen (M46-S01)', () => {
  it('counts down with a plural aware message and translated buttons', () => {
    render(wrap(<EndScreen {...endBase} countdown={4} />));
    expect(screen.getByText('[Up next in 4 seconds]')).toBeTruthy();
    expect(screen.getByRole('button', { name: '[Play now]' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '[Cancel]' })).toBeTruthy();
    expect(screen.getByRole('region', { name: '[Up next]' })).toBeTruthy();
  });
  it('says one second, not 1 seconds', () => {
    render(wrap(<EndScreen {...endBase} countdown={1} />));
    expect(screen.getByText('[Up next in 1 second]')).toBeTruthy();
  });
  it('translates the next up state, autoplay notes and list buttons', () => {
    render(wrap(<EndScreen {...endBase} cancelled />));
    expect(screen.getByText('[Autoplay cancelled]')).toBeTruthy();
    expect(screen.getByText('[Next: Why the Sky Is Blue]')).toBeTruthy();
    expect(screen.getByRole('button', { name: '[Play next]' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '[Replay]' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '[Back to series]' })).toBeTruthy();
    cleanup();
    render(wrap(<EndScreen {...endBase} autoplayNext={false} />));
    expect(screen.getByText('[Autoplay is off]')).toBeTruthy();
    expect(screen.getByRole('button', { name: '[Add to My List]' })).toBeTruthy();
  });
  it('translates the finished states', () => {
    const done = { ...endBase, next: null };
    render(
      wrap(
        <EndScreen
          {...done}
          data={{ ...endBase.data, lastInSeries: true, seriesTitle: 'Science' }}
        />,
      ),
    );
    expect(screen.getByText('[You finished Science]')).toBeTruthy();
    expect(
      screen.getByText('[Well done. Try another series or watch a video again.]'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: '[Back to the series]' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '[Browse more]' })).toBeTruthy();
    cleanup();
    render(
      wrap(
        <EndScreen {...done} data={{ ...endBase.data, onAddToList: undefined, inMyList: true }} />,
      ),
    );
    expect(screen.getByText('[Thanks for watching]')).toBeTruthy();
    expect(screen.getByRole('link', { name: '[Back to Home]' })).toBeTruthy();
    cleanup();
    render(wrap(<EndScreen {...done} data={{ ...endBase.data, inMyList: true }} />));
    expect(screen.getByRole('button', { name: '[In My List]' })).toBeTruthy();
  });
  it('titles the related row', () => {
    const related = [{ id: 'r1', title: 'Rain', href: '/r' }];
    render(wrap(<EndScreen {...endBase} data={{ ...endBase.data, related }} />));
    expect(screen.getByText('[More like this]')).toBeTruthy();
  });
});

describe('player wave D: seek bar and spoken time', () => {
  it('labels the slider and the chapter value text from t', () => {
    render(
      wrap(
        <SeekBar
          currentTime={30}
          duration={100}
          bufferedEnd={0}
          onSeek={() => {}}
          chapters={[{ start: 0, title: 'Mixing colours' }]}
        />,
      ),
    );
    const slider = screen.getByRole('slider', { name: '[Seek]' });
    expect(slider.getAttribute('aria-valuetext')).toBe(
      '[[[30 seconds] of [1 minute] [40 seconds]], chapter Mixing colours]',
    );
  });
  it('spokenTime and seekValueText read units through t, with plurals', () => {
    expect(spokenTime(3661, t)).toBe('[1 hour] [1 minute] [1 second]');
    expect(spokenTime(120, t)).toBe('[2 minutes]');
    expect(seekValueText(30, 100, t)).toBe('[[30 seconds] of [1 minute] [40 seconds]]');
    expect(seekValueText(30, 0, t)).toBe('[30 seconds]');
    expect(spokenTime(61)).toBe('1 minute 1 second');
  });
});

describe('player wave D: shortcuts dialog and caption appearance', () => {
  it('translates the title, lead, rows, key names and Close', () => {
    render(wrap(<ShortcutsDialog onClose={() => {}} />));
    expect(screen.getByText('[Keyboard shortcuts]')).toBeTruthy();
    expect(screen.getByText('[These work when the player has focus.]')).toBeTruthy();
    expect(screen.getByText('[Play or pause]')).toBeTruthy();
    expect(screen.getByText('[Theatre mode]')).toBeTruthy();
    expect(screen.getByText('[Space]')).toBeTruthy();
    expect(screen.getByText('[Esc]')).toBeTruthy();
    expect(screen.getByRole('button', { name: '[Close]' })).toBeTruthy();
  });
  it('translates the option names', () => {
    render(
      wrap(
        <CaptionAppearance style={DEFAULT_CAPTION_STYLE} onChange={() => {}} onClose={() => {}} />,
      ),
    );
    expect(screen.getAllByText('[Small]').length).toBe(1);
    expect(screen.getByText('[Extra large]')).toBeTruthy();
    expect(screen.getAllByText('[None]').length).toBe(2);
    expect(screen.getByText('[Outline]')).toBeTruthy();
    expect(screen.getByText('[High]')).toBeTruthy();
  });
  it('translates Normal and the autoplay On and Off', () => {
    render(wrap(<SpeedRows rate={1} onSelect={() => {}} />));
    expect(screen.getByText('[Normal]')).toBeTruthy();
    cleanup();
    render(
      wrap(
        <SettingsMenu
          rate={1}
          quality={null}
          autoplayNext
          onRate={() => {}}
          onQuality={() => {}}
          onAutoplay={() => {}}
          onClose={() => {}}
        />,
      ),
    );
    expect(screen.getByText('[On]')).toBeTruthy();
  });
});

describe('player wave D: transport buttons and announcements', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  function setup(withDuration = true, autoplay = true) {
    const media = new FakeMedia();
    const controller = new PlayerController({
      media,
      engine: new FakeEngine(),
      tokens: { token: 'x', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
      videoId: 'v1',
      profileId: 'p1',
      sink: { save: vi.fn().mockResolvedValue(undefined) },
      network: new FakeNetwork(),
      captions: [],
      autoplay,
      t,
    });
    controller.start();
    if (withDuration) act(() => media.setDuration(352));
    render(<PlayerView controller={controller} title="How Rain Is Made" t={t} />);
    return { controller, ui: userEvent.setup() };
  }

  it('Play, Pause, Mute and Unmute come from t', async () => {
    const { ui } = setup();
    expect(screen.getByRole('button', { name: '[Pause]' })).toBeTruthy();
    await ui.click(screen.getByRole('button', { name: '[Pause]' }));
    expect(screen.getByRole('button', { name: '[Play]' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '[Mute]' })).toBeTruthy();
    await ui.click(screen.getByRole('button', { name: '[Mute]' }));
    expect(screen.getByRole('button', { name: '[Unmute]' })).toBeTruthy();
  });

  it('the Loading announcement comes from t', () => {
    vi.useFakeTimers();
    try {
      const { controller } = setup(false, false);
      act(() => {
        vi.advanceTimersByTime(20_000);
      });
      expect(controller.getState().announce).toBe('[Loading]');
    } finally {
      vi.useRealTimers();
    }
  });
});
