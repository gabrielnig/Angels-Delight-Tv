import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayerController } from '../controller';
import { FakeEngine, FakeMedia, FakeNetwork } from '../testing/fakes';
import { PlayerView } from './PlayerView';

const proto = HTMLVideoElement.prototype as unknown as Record<string, unknown>;
const doc = document as unknown as Record<string, unknown>;

function setup() {
  const media = new FakeMedia();
  const controller = new PlayerController({
    media,
    engine: new FakeEngine(),
    tokens: { token: 't', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    network: new FakeNetwork(),
  });
  controller.start();
  act(() => media.setDuration(300));
  render(<PlayerView controller={controller} title="Rain" />);
  return { controller };
}

function webkitOnly() {
  proto.webkitSupportsPresentationMode = () => true;
  proto.webkitSetPresentationMode = vi.fn(function (this: Record<string, unknown>, mode: string) {
    this.webkitPresentationMode = mode;
    (this as unknown as EventTarget).dispatchEvent(new Event('webkitpresentationmodechanged'));
  });
}

afterEach(() => {
  cleanup();
  delete proto.webkitSupportsPresentationMode;
  delete proto.webkitSetPresentationMode;
  delete proto.requestPictureInPicture;
  delete doc.pictureInPictureEnabled;
  delete doc.pictureInPictureElement;
  delete doc.exitPictureInPicture;
});

describe('PlayerView picture in picture (L4-10)', () => {
  it('shows the PiP button when only the webkit API exists', () => {
    webkitOnly();
    setup();
    expect(screen.getByRole('button', { name: 'Picture in picture' })).toBeTruthy();
  });

  it('hides the button where neither API exists', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Picture in picture' })).toBeNull();
  });

  it('sets aria-pressed while in picture in picture, with the standard API', async () => {
    doc.pictureInPictureEnabled = true;
    proto.requestPictureInPicture = vi.fn(async function (this: HTMLVideoElement) {
      doc.pictureInPictureElement = this;
      this.dispatchEvent(new Event('enterpictureinpicture'));
    });
    setup();
    const button = screen.getByRole('button', { name: 'Picture in picture' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await act(async () => fireEvent.click(button));
    expect(button.getAttribute('aria-pressed')).toBe('true');
    act(() => {
      doc.pictureInPictureElement = null;
      document.querySelector('video')!.dispatchEvent(new Event('leavepictureinpicture'));
    });
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the in a small window message and a Bring back button', async () => {
    webkitOnly();
    setup();
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Picture in picture' })),
    );
    expect(screen.getByText('Playing in a small window')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Bring back' })));
    expect(screen.queryByText('Playing in a small window')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Picture in picture' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('shows a toast when picture in picture is denied', async () => {
    doc.pictureInPictureEnabled = true;
    proto.requestPictureInPicture = vi.fn(async () => {
      throw new DOMException('denied', 'NotAllowedError');
    });
    const { controller } = setup();
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Picture in picture' })),
    );
    expect(controller.getState().toast).toMatchObject({ kind: 'error' });
  });
});
