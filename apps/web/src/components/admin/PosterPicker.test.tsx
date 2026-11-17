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
