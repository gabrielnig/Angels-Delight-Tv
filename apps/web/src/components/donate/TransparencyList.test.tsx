// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TransparencyList } from './TransparencyList';

afterEach(cleanup);

describe('TransparencyList', () => {
  it('shows each percent line with its label, note and a progress bar, and the updated date', () => {
    render(
      <TransparencyList
        title="How gifts are used"
        intro="Every naira is accounted for."
        updatedAt="2026-12-01"
        items={[
          { label: 'Hosting', percent: 60, note: 'Servers and bandwidth' },
          { label: 'Captions', percent: 40, note: '' },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'How gifts are used' })).toBeInTheDocument();
    expect(screen.getByText('Every naira is accounted for.')).toBeInTheDocument();
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('60%')).toBeInTheDocument();
    expect(within(list).getByText('Servers and bandwidth')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
    expect(screen.getByRole('progressbar', { name: /hosting/i })).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getByText(/updated 1 December 2026/i)).toBeInTheDocument();
  });

  it('shows amount lines in naira and no progress bar', () => {
    render(<TransparencyList title="T" intro="" updatedAt={null} items={[{ label: 'Hosting', amount_minor: 1250000, note: '' }]} />);
    expect(screen.getByText('₦12,500')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/updated/i)).not.toBeInTheDocument();
  });

  it('shows a plain empty message when there are no items, and escapes markup as text', () => {
    const { container } = render(<TransparencyList title="T" intro="<b>bold</b>" updatedAt={null} items={[]} />);
    expect(screen.getByText(/we have not published the details yet/i)).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText('<b>bold</b>')).toBeInTheDocument();
  });

  it('carries no donor names, emails or links to other sites', () => {
    const { container } = render(<TransparencyList title="T" intro="" updatedAt={null} items={[{ label: 'Hosting', percent: 100, note: '' }]} />);
    expect(container.querySelectorAll('a[href^="http"], script, iframe')).toHaveLength(0);
  });
});
