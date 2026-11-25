// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HelpVideo } from './HelpVideo';

afterEach(cleanup);
const cues = [
  { start: 0.5, end: 3, text: 'Click Upload.' },
  { start: 65, end: 68, text: 'Wait for Done.' },
];
const base = {
  guide: 'D02',
  videoId: 'VD02',
  title: 'Upload one video',
  phone: false,
  captions: 'track' as const,
  cues,
  watched: false,
  onWatched: async () => ({ ok: true }),
};

describe('HelpVideo', () => {
  it('is a native player with a poster, no autoplay, no sound track, a caption track and quality choice', () => {
    const { container } = render(<HelpVideo {...base} />);
    const video = container.querySelector('video')!;
    expect(video).toHaveAttribute('controls');
    expect(video).not.toHaveAttribute('autoplay');
    expect(video).not.toHaveAttribute('loop');
    expect(video).toHaveAttribute('playsinline');
    expect(video).toHaveAttribute('preload', 'none');
    expect(video.getAttribute('poster')).toBe('/admin/help/media/video/VD02/VD02-poster.webp');
    expect(video.getAttribute('src')).toBe('/admin/help/media/video/VD02/VD02-720.mp4');
    const track = video.querySelector('track')!;
    expect(track.getAttribute('src')).toBe('/admin/help/media/video/VD02/VD02-captions.vtt');
    expect(track.getAttribute('kind')).toBe('captions');
    expect(screen.getByRole('combobox', { name: 'Quality' })).toBeInTheDocument();
  });

  it('draws no caption track when the captions are burned into the recording', () => {
    const { container } = render(<HelpVideo {...base} captions="burned" />);
    expect(container.querySelector('track')).toBeNull();
  });

  it('switches quality and keeps one source', async () => {
    const { container } = render(<HelpVideo {...base} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Quality' }), '480');
    expect(container.querySelector('video')!.getAttribute('src')).toBe(
      '/admin/help/media/video/VD02/VD02-480.mp4',
    );
  });

  it('lists every caption in Read this video and jumps the video to it', async () => {
    const { container } = render(<HelpVideo {...base} />);
    const video = container.querySelector('video')! as HTMLVideoElement;
    const transcript = screen.getByText('Read this video').closest('details')!;
    const buttons = within(transcript).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      '0:00 Click Upload.',
      '1:05 Wait for Done.',
    ]);
    await userEvent.click(buttons[1]!);
    expect(video.currentTime).toBe(65);
  });

  it('counts the video as watched once at 90 percent, and by button', async () => {
    const onWatched = vi.fn(async () => ({ ok: true }));
    const { container } = render(<HelpVideo {...base} onWatched={onWatched} />);
    const video = container.querySelector('video')! as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 100, configurable: true });
    Object.defineProperty(video, 'currentTime', { value: 50, writable: true, configurable: true });
    fireEvent.timeUpdate(video);
    expect(onWatched).not.toHaveBeenCalled();
    video.currentTime = 91;
    fireEvent.timeUpdate(video);
    fireEvent.timeUpdate(video);
    expect(onWatched).toHaveBeenCalledTimes(1);
    expect(onWatched).toHaveBeenCalledWith('D02');
    cleanup();
    const again = vi.fn(async () => ({ ok: true }));
    render(<HelpVideo {...base} onWatched={again} />);
    await userEvent.click(screen.getByRole('button', { name: 'Mark as watched' }));
    expect(again).toHaveBeenCalledWith('D02');
  });

  it('shows the transcript and one action when the file will not load', async () => {
    const { container } = render(<HelpVideo {...base} />);
    fireEvent.error(container.querySelector('video')!);
    expect(screen.getByRole('alert')).toHaveTextContent('The video did not load.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByText('Click Upload.')).toBeInTheDocument();
  });

  it('offers the phone recording when there is one', () => {
    const { container } = render(<HelpVideo {...base} phone />);
    expect(screen.getByRole('combobox', { name: 'Picture' })).toBeInTheDocument();
    expect(container.querySelector('video')!.getAttribute('src')).toBe(
      '/admin/help/media/video/VD02/VD02-720.mp4',
    );
  });
});
