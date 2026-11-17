// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewPlayer } from './PreviewPlayer';

const shown = vi.hoisted(() => ({ props: undefined as Record<string, unknown> | undefined }));
vi.mock('@ad/player', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Player: (props: Record<string, unknown>) => {
    shown.props = props;
    return <div data-testid="player" />;
  },
}));

afterEach(cleanup);

const video = { id: 'vid-1', title: 'Rivers of Africa', durationSeconds: 540, posterUrl: null };

describe('PreviewPlayer', () => {
  it('says this is a staff preview and shows the player', async () => {
    render(<PreviewPlayer video={video} captions={[]} backHref="/admin/videos/vid-1" />);
    expect(screen.getByText(/Only signed in staff can see this preview/)).toBeInTheDocument();
    expect(await screen.findByTestId('player')).toBeInTheDocument();
  });

  it('plays the video with a preview session and records no viewer progress', async () => {
    render(<PreviewPlayer video={video} captions={[]} backHref="/admin/videos/vid-1" />);
    await screen.findByTestId('player');
    const props = shown.props!;
    expect(props.videoId).toBe('vid-1');
    expect(props.title).toBe('Rivers of Africa');
    const sink = props.progressSink as { save: (u: unknown) => Promise<void> };
    await expect(sink.save({})).resolves.toBeUndefined();
    expect(typeof (props.sessionProvider as { createSession: unknown }).createSession).toBe(
      'function',
    );
  });

  it('links back to the video screen', async () => {
    render(<PreviewPlayer video={video} captions={[]} backHref="/admin/videos/vid-1" />);
    expect(screen.getByRole('link', { name: 'Back to the video' })).toHaveAttribute(
      'href',
      '/admin/videos/vid-1',
    );
  });
});
