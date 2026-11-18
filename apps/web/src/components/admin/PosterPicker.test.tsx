// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const { PosterPicker } = await import('./PosterPicker');

function setup() {
  const save = vi.fn(async () => ({ ok: true as const }));
  render(
    <PosterPicker
      videoId="v1"
      title="Staying Safe Online"
      durationSeconds={363}
      initial={{ posterId: null, alt: null, focus: null }}
      save={save}
    />,
  );
  return { save };
}

describe('PosterPicker', () => {
  it('offers six frames and marks the chosen one', async () => {
    setup();
    const frames = screen.getByRole('list', { name: 'Candidate frames' });
    expect(frames.querySelectorAll('button')).toHaveLength(6);
    await userEvent.click(frames.querySelectorAll('button')[4]!);
    expect(frames.querySelectorAll('button')[4]).toHaveAttribute('aria-pressed', 'true');
  });

  it('will not save without alt text', async () => {
    const { save } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Save poster' }));
    expect(
      await screen.findByText('Describe the poster for people who cannot see it.'),
    ).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it('moves the focus point with the keyboard and saves it', async () => {
    const { save } = setup();
    const marker = screen.getByRole('button', { name: /Focus point at 50, 50/ });
    marker.focus();
    fireEvent.keyDown(marker, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(marker, { key: 'ArrowUp' });
    expect(screen.getByRole('button', { name: /Focus point at 60, 48/ })).toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText('Poster description (alt text)'),
      'A student at a bus stop',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save poster' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        focus: { x: 60, y: 48 },
        zoom: 100,
        alt: 'A student at a bus stop',
      }),
    );
  });

  it('has a typed alternative to clicking for the focus point', async () => {
    setup();
    const across = screen.getByLabelText('Focus across (0 to 100)');
    await userEvent.clear(across);
    await userEvent.type(across, '80');
    expect(screen.getByRole('button', { name: /Focus point at 80, 50/ })).toBeInTheDocument();
  });
});

describe('PosterPicker with real pictures', () => {
  const U1 = '0192f0a0-0000-7000-8000-000000000001';
  const U2 = '0192f0a0-0000-7000-8000-000000000002';
  const assets = [
    {
      id: U1,
      source: 'frame' as const,
      label: 'Frame 1',
      status: 'ready' as const,
      url: 'https://m.test/a.webp',
      score: 80,
      previewRatio: 16 / 9,
    },
    {
      id: U2,
      source: 'frame' as const,
      label: 'Frame 2',
      status: 'processing' as const,
      url: null,
      score: null,
      previewRatio: 16 / 9,
    },
  ];

  function setupReal(extra: Record<string, unknown> = {}) {
    const save = vi.fn(async () => ({ ok: true as const }));
    render(
      <PosterPicker
        videoId="v1"
        title="Staying Safe Online"
        durationSeconds={100}
        initial={{ posterId: null, alt: 'Alt text here', focus: null }}
        save={save}
        assets={assets}
        {...extra}
      />,
    );
    return { save };
  }

  it('lists the real frames, shows the one still processing and saves the real id', async () => {
    const { save } = setupReal();
    const frames = screen.getByRole('list', { name: 'Candidate frames' });
    expect(frames.querySelectorAll('button')).toHaveLength(2);
    expect(screen.getByText('Processing')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save poster' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ posterId: U1 }));
  });

  it('will not save a picture that is still processing', async () => {
    const { save } = setupReal({ initial: { posterId: U2, alt: 'Alt', focus: null } });
    await userEvent.click(screen.getByRole('button', { name: 'Save poster' }));
    expect(await screen.findByText(/still being prepared/i)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it('uploads a file, polls until it is ready and then allows saving it', async () => {
    const NEW = '0192f0a0-0000-7000-8000-000000000009';
    const upload = vi.fn(async () => ({ ok: true as const, assetId: NEW }));
    const status = vi
      .fn<(id: string) => Promise<{ status: 'processing' | 'ready' | 'failed' }>>()
      .mockResolvedValueOnce({ status: 'processing' })
      .mockResolvedValue({ status: 'ready' });
    const { save } = setupReal({ upload, status, pollMs: 5 });
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'p.png', {
      type: 'image/png',
    });
    // jsdom cannot decode images, so the browser size check is skipped when a server upload is wired.
    await userEvent.upload(screen.getByLabelText('Choose a poster image'), png);
    await waitFor(() => expect(upload).toHaveBeenCalled());
    await waitFor(() => expect(status).toHaveBeenCalledTimes(2));
    // Frame 2 stays processing, the new picture is done.
    await waitFor(() => expect(screen.getAllByText('Processing')).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'Save poster' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ posterId: NEW })),
    );
  });

  it('shows the server message when an upload is refused', async () => {
    const upload = vi.fn(async () => ({
      ok: false as const,
      error: 'That image is 800 by 450. Use at least 1280 by 720.',
    }));
    setupReal({ upload, status: vi.fn() });
    const png = new File([new Uint8Array([1])], 'p.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Choose a poster image'), png);
    expect(await screen.findByText(/800 by 450/)).toBeInTheDocument();
  });
});

describe('PosterPicker preview of a picture that is not 16 by 9 (M36-S03)', () => {
  const SQUARE = '0192f0a0-0000-7000-8000-0000000000aa';
  it('places the preview from the real shape of the picture, not as a 16:9 frame', () => {
    render(
      <PosterPicker
        videoId="v1"
        title="Staying Safe Online"
        durationSeconds={100}
        initial={{ posterId: SQUARE, alt: 'Alt', focus: { x: 50, y: 100, zoom: 100 } }}
        save={vi.fn()}
        assets={[
          {
            id: SQUARE,
            source: 'upload',
            label: 'Your image',
            status: 'ready',
            url: 'https://m.test/full.webp',
            score: null,
            previewRatio: 1,
          },
        ]}
      />,
    );
    const card = screen.getByText('Video card crop').closest('figure')!;
    const img = card.querySelector('img')!;
    // A square picture cut to 16:9 is 56.25 percent of its height, so the 16:9 frame shows it 177.78 percent tall,
    // and a focus at the bottom holds the cut at the bottom edge.
    expect(img.style.height).toBe('177.78%');
    expect(img.style.top).toBe('-77.78%');
  });
});

describe('PosterPicker recut state (M36-S03)', () => {
  const ID = '0192f0a0-0000-7000-8000-0000000000bb';
  const show = (recut: 'processing' | 'failed' | null) =>
    render(
      <PosterPicker
        videoId="v1"
        title="Staying Safe Online"
        durationSeconds={100}
        initial={{ posterId: ID, alt: 'Alt', focus: { x: 20, y: 30, zoom: 130 } }}
        recut={recut}
        save={vi.fn()}
        assets={[
          {
            id: ID,
            source: 'upload',
            label: 'Your image',
            status: 'ready',
            url: 'https://m.test/a.webp',
            score: null,
            previewRatio: 16 / 9,
          },
        ]}
      />,
    );
  it('says the crop failed and the old poster is still showing', () => {
    show('failed');
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('The crop could not be applied to the poster files');
    expect(banner).toHaveTextContent('old poster is still showing');
    expect(banner).toHaveTextContent('Save again');
  });
  it('says the crop is still being applied', () => {
    show('processing');
    expect(screen.getByRole('status')).toHaveTextContent('Applying the crop');
  });
  it('shows nothing when there is no recut to report', () => {
    show(null);
    expect(screen.queryByText(/crop could not be applied/i)).toBeNull();
    expect(screen.queryByText(/Applying the crop/i)).toBeNull();
  });
});

describe('PosterPicker low score warning (M36-S01)', () => {
  const frame = (n: number, score: number | null) => ({
    id: `a${n}`,
    source: 'frame' as const,
    label: `Frame ${n}`,
    status: 'ready' as const,
    url: `https://m.test/${n}.webp`,
    score,
    previewRatio: 16 / 9,
  });
  const show = (scores: (number | null)[]) =>
    render(
      <PosterPicker
        videoId="v1"
        title="Staying Safe Online"
        durationSeconds={363}
        initial={{ posterId: null, alt: null, focus: null }}
        save={vi.fn(async () => ({ ok: true as const }))}
        assets={scores.map((s, i) => frame(i + 1, s))}
      />,
    );

  it('suggests uploading a picture when every frame scores low', () => {
    show([5, 12, 20, 0, 30, 8]);
    expect(screen.getByText(/dark or blurry/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload your own' })).toBeInTheDocument();
  });

  it('stays quiet when one frame is good, and for videos with no scores', () => {
    const { unmount } = show([5, 90, 20]);
    expect(screen.queryByText(/dark or blurry/i)).toBeNull();
    unmount();
    show([null, null]);
    expect(screen.queryByText(/dark or blurry/i)).toBeNull();
  });
});
