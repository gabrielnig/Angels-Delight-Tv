// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrintButton } from './PrintButton';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PrintButton (M50-S09)', () => {
  it('prints with the browser dialog, which also saves as PDF', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    render(<PrintButton guide="D02" />);
    await userEvent.click(screen.getByRole('button', { name: 'Print or save as PDF' }));
    expect(print).toHaveBeenCalled();
  });

  it('downloads the prebuilt PDF when the release has one', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const print = vi.fn();
    vi.stubGlobal('print', print);
    render(<PrintButton guide="D02" />);
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('/admin/help/media/pdf/D02.pdf', { method: 'HEAD' });
    expect(print).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it('falls back to the print dialog when the PDF is missing or the check fails', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    render(<PrintButton guide="D02" />);
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(2));
  });
});
