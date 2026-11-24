// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreativesEditor, type CreativeView } from './CreativesEditor';
import { ToastProvider } from './Toast';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
afterEach(cleanup);

const existing: CreativeView = {
  id: 'c1',
  headline: 'Learn with Acme',
  body: null,
  ctaLabel: 'Visit',
  destinationUrl: 'https://acme.example',
  altText: 'Acme logo',
  weight: 1,
  active: true,
  slots: ['home_banner'],
  imageSquareAssetId: null,
  imageWideAssetId: null,
};
const ok = () => vi.fn().mockResolvedValue({ ok: true });
const actions = () => ({ add: ok(), update: ok(), remove: ok(), upload: vi.fn().mockResolvedValue({ ok: true, assetId: 'a1' }) });
const view = (a = actions(), creatives: CreativeView[] = [existing]) => {
  render(
    <ToastProvider>
      <CreativesEditor sponsorId="s1" creatives={creatives} actions={a} />
    </ToastProvider>,
  );
  return a;
};

describe('CreativesEditor', () => {
  it('lists placements in plain words with the ticked ones checked', () => {
    view();
    expect((screen.getAllByLabelText('Home page banner')[0] as HTMLInputElement).checked).toBe(true);
    expect((screen.getAllByLabelText('After the video')[0] as HTMLInputElement).checked).toBe(false);
  });
  it('adds a creative with the ticked placements', async () => {
    const a = view(actions(), []);
    fireEvent.click(screen.getByRole('button', { name: 'Add creative' }));
    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'https://x.example' } });
    fireEvent.click(screen.getByLabelText('After the video'));
    fireEvent.click(screen.getByRole('button', { name: 'Save creative' }));
    await waitFor(() => expect(a.add).toHaveBeenCalled());
    const [id, body, slots] = a.add.mock.calls[0]!;
    expect(id).toBe('s1');
    expect(body).toMatchObject({ headline: 'Hello', destinationUrl: 'https://x.example' });
    expect(slots).toEqual(['player_after']);
  });
  it('removes a creative after confirming', async () => {
    const a = view();
    fireEvent.click(screen.getByRole('button', { name: 'Remove creative' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(a.remove).toHaveBeenCalledWith('c1'));
  });
});
