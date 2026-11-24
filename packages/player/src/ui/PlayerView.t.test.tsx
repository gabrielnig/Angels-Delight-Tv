import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { msg, type Translate } from '@ad/shared/messages';
import { PlayerController } from '../controller';
import type { CaptionTrack } from '../types';
import { FakeEngine, FakeMedia, FakeNetwork } from '../testing/fakes';
import { PlayerView } from './PlayerView';

const track = (language: string, label: string): CaptionTrack => ({
  id: language,
  language,
  label,
  src: `/c/${language}.vtt`,
  status: 'approved',
});

/** A visible stand in for a translated catalog: every string is the English text in brackets. */
const t: Translate = (key, params) => `[${msg(key, params)}]`;

function setup(captions: CaptionTrack[], view: { t?: Translate } = { t }) {
  const media = new FakeMedia();
  const controller = new PlayerController({
    media,
    engine: new FakeEngine(),
    tokens: { token: 'x', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    network: new FakeNetwork(),
    captions,
    t: view.t,
  });
  controller.start();
  act(() => media.setDuration(352));
  render(<PlayerView controller={controller} title="How Rain Is Made" {...view} />);
  return { controller, ui: userEvent.setup() };
}

describe('PlayerView t prop (M46-S14)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders control labels from the t prop', () => {
    setup([track('en', 'English')]);
    expect(screen.getByRole('button', { name: '[Captions]' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '[Settings]' })).toBeTruthy();
  });

  it('renders the caption menu from the t prop, with Off first and each language by its own name', async () => {
    const { ui } = setup([track('en', 'English'), track('yo', 'Yorùbá')]);
    await ui.click(screen.getByRole('button', { name: /^\[Captions, off\]$/ }));
    const rows = screen.getAllByRole('menuitemradio');
    expect(rows.map((r) => r.textContent?.trim())).toEqual(['[Off]', 'English', 'Yorùbá']);
    expect(rows[2]!.getAttribute('lang')).toBe('yo');
  });

  it('with one track there is a toggle and no menu', async () => {
    const { ui } = setup([track('en', 'English')]);
    const button = screen.getByRole('button', { name: '[Captions]' });
    expect(button.getAttribute('aria-haspopup')).toBeNull();
    await ui.click(button);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('without a t prop the English catalog is used', () => {
    setup([track('en', 'English')], {});
    expect(screen.getByRole('button', { name: 'Captions' })).toBeTruthy();
  });
});
