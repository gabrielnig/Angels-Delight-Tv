// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HelpHome } from './HelpHome';
import { sampleLibrary } from './fixtures';

afterEach(cleanup);
const lib = sampleLibrary();
const base = { library: lib, showAll: false, supportContact: '' };

describe('HelpHome', () => {
  it('puts Start here first and lists every other path with its counts', () => {
    render(<HelpHome {...base} role="super_admin" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Help centre' })).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings[0]).toBe('Start here');
    expect(headings).toContain('Learning paths');
    const daily = screen.getByRole('link', { name: /Daily tasks/ });
    expect(daily).toHaveAttribute('href', '/admin/help/path/daily');
    expect(daily).toHaveTextContent('2 guides');
  });

  it('hides guides for a higher role behind a count with a Show them link', () => {
    render(<HelpHome {...base} role="editor" />);
    const note = screen.getByRole('status');
    expect(note).toHaveTextContent('2 guides for a higher role are hidden');
    expect(within(note).getByRole('link', { name: 'Show them' })).toHaveAttribute(
      'href',
      '/admin/help?show=all',
    );
    expect(screen.getByRole('link', { name: /Daily tasks/ })).toHaveTextContent('1 guide');
  });

  it('shows them when asked, with a way to hide again', () => {
    render(<HelpHome {...base} role="editor" showAll />);
    const note = screen.getByRole('status');
    expect(note).toHaveTextContent('Showing 2 guides for a higher role');
    expect(within(note).getByRole('link', { name: 'Hide them' })).toHaveAttribute(
      'href',
      '/admin/help',
    );
  });

  it('shows no note to a super admin', () => {
    render(<HelpHome {...base} role="super_admin" />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the contact from the setting, or a placeholder with no link', () => {
    render(<HelpHome {...base} role="editor" supportContact="help@example.org" />);
    expect(screen.getByRole('link', { name: /Message ARKDEV/ })).toHaveAttribute(
      'href',
      'mailto:help@example.org',
    );
    cleanup();
    render(<HelpHome {...base} role="editor" supportContact="https://wa.me/2340000000" />);
    expect(screen.getByRole('link', { name: /Message ARKDEV/ })).toHaveAttribute(
      'href',
      'https://wa.me/2340000000',
    );
    cleanup();
    render(<HelpHome {...base} role="editor" supportContact="" />);
    expect(screen.queryByRole('link', { name: /Message ARKDEV/ })).toBeNull();
    expect(screen.getByText(/contact has not been set yet/i)).toBeInTheDocument();
  });
});
