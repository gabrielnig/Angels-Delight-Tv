// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InlineHint } from './InlineHint';
import { HelpPanelHost } from './HelpPanelHost';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/site' }));
afterEach(cleanup);

const hint = (
  <InlineHint field="Site name" guide="C01" section="step-2" learnMore="change the site name">
    This name shows in the browser tab and in emails.
  </InlineHint>
);

describe('InlineHint (S197 inline hint pattern)', () => {
  it('starts closed with a named button that controls the hint', () => {
    render(hint);
    const button = screen.getByRole('button', { name: 'Help for Site name' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const id = button.getAttribute('aria-controls') as string;
    expect(document.getElementById(id)).toHaveAttribute('hidden');
  });

  it('opens with Enter and Space and closes with Escape, returning focus to the button', async () => {
    const user = userEvent.setup();
    render(hint);
    const button = screen.getByRole('button', { name: 'Help for Site name' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/This name shows/)).toBeVisible();
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(button);
    await user.keyboard(' ');
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('links to the exact section of the guide, and works without the panel', async () => {
    const user = userEvent.setup();
    render(hint);
    await user.click(screen.getByRole('button', { name: 'Help for Site name' }));
    expect(screen.getByRole('link', { name: 'Learn more: change the site name' })).toHaveAttribute(
      'href',
      '/admin/help/C01#step-2',
    );
  });

  it('opens the guide in the side panel so the form is kept', async () => {
    const load = vi.fn(async () => ({
      ok: true as const,
      data: { pathname: '/admin/site', guides: [], core: [] },
      cues: [],
    }));
    const user = userEvent.setup();
    render(
      <HelpPanelHost load={load} onWatched={async () => ({ ok: true })}>
        <input aria-label="Site name field" defaultValue="Learn Well TV" />
        {hint}
      </HelpPanelHost>,
    );
    await user.click(screen.getByRole('button', { name: 'Help for Site name' }));
    await user.click(screen.getByRole('link', { name: 'Learn more: change the site name' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(load).toHaveBeenCalledWith('/admin/site', 'C01');
    expect(screen.getByRole('textbox', { name: 'Site name field' })).toHaveValue('Learn Well TV');
  });
});
