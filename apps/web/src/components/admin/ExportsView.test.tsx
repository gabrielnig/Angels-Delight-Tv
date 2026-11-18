// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportConfirm, ExportsView, type ExportItem } from './ExportsView';

afterEach(cleanup);

const base: ExportItem = {
  id: '0192f0a0-0000-7000-8000-000000000001',
  name: 'Audit log',
  status: 'ready',
  rows: 52_000,
  bytes: 4_200_000,
  askedAt: '2026-06-10T10:00:00.000Z',
  expiresAt: '2026-06-13T10:00:00.000Z',
  error: null,
};

describe('ExportsView', () => {
  it('lists each export with its status, rows and size, and a download link only when ready', () => {
    render(
      <ExportsView
        items={[
          base,
          { ...base, id: 'b', status: 'queued', rows: null, bytes: null, expiresAt: null },
          { ...base, id: 'c', status: 'running', rows: null, bytes: null, expiresAt: null },
          {
            ...base,
            id: 'd',
            status: 'failed',
            error: 'Too many rows for one file. Narrow the filters or the dates and try again.',
            expiresAt: null,
          },
        ]}
      />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    expect(within(rows[0]!).getByText('Ready')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('52,000')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('4.0 MB')).toBeInTheDocument();
    const link = within(rows[0]!).getByRole('link', { name: /Download Audit log/ });
    expect(link).toHaveAttribute('href', `/admin/exports/${base.id}/download`);
    expect(within(rows[1]!).getByText('Waiting')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Building')).toBeInTheDocument();
    expect(within(rows[3]!).getByText('Failed')).toBeInTheDocument();
    expect(within(rows[3]!).getByText(/Narrow the filters/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Download/ })).toHaveLength(1);
  });

  it('says how long a ready file stays, in plain words', () => {
    render(<ExportsView items={[base]} />);
    expect(screen.getByText(/Until 13 Jun 2026/)).toBeInTheDocument();
  });

  it('shows an empty state with a next step when there are none', () => {
    render(<ExportsView items={[]} />);
    expect(screen.getByText('No exports yet.')).toBeInTheDocument();
    expect(screen.getByText(/larger than 10,000 rows/)).toBeInTheDocument();
  });

  it('shows a confirmation after one was asked for, and a plain error for a known problem', () => {
    const { rerender } = render(<ExportsView items={[]} notice="asked" />);
    expect(screen.getByRole('status')).toHaveTextContent(/email/i);
    rerender(<ExportsView items={[]} notice="busy" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/waiting/i);
    rerender(<ExportsView items={[]} notice="invalid" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('never shows a dash or an emoji', () => {
    const { container } = render(<ExportsView items={[base]} notice="asked" />);
    expect(container.textContent).not.toMatch(/[\u2013\u2014]/);
  });
});

describe('ExportConfirm', () => {
  const action = vi.fn(async () => undefined);

  it('says how many rows, that it is built in the background and emailed, and posts the filters it was given', () => {
    const { container } = render(
      <ExportConfirm
        name="Audit log"
        rows={52_000}
        summary={['Action starts with video.', 'From 1 Jun 2026']}
        fields={{ kind: 'audit', action: 'video.', from: '2026-06-01' }}
        action={action}
      />,
    );
    expect(screen.getByText(/52,000 rows/)).toBeInTheDocument();
    expect(screen.getByText(/emailed to you|email you/i)).toBeInTheDocument();
    expect(screen.getByText('Action starts with video.')).toBeInTheDocument();
    const form = container.querySelector('form')!;
    expect(form.getAttribute('method')?.toLowerCase()).not.toBe('get');
    const hidden = [...form.querySelectorAll('input[type=hidden]')].map((i) => [
      (i as HTMLInputElement).name,
      (i as HTMLInputElement).value,
    ]);
    expect(hidden).toEqual([
      ['kind', 'audit'],
      ['action', 'video.'],
      ['from', '2026-06-01'],
    ]);
    expect(screen.getByRole('button', { name: 'Build the file and email me' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toBeInTheDocument();
  });
});
