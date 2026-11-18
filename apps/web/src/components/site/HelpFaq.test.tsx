// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HelpFaq } from './HelpFaq';

const articles = [
  { id: 'a', question: 'How do I reset my password?', answer: 'Use Forgot password on sign in.' },
  { id: 'b', question: 'How do I add a profile?', answer: 'Open Manage profiles.' },
];

describe('HelpFaq', () => {
  it('lists every question as a disclosure button', () => {
    render(<HelpFaq articles={articles} supportEmail="help@example.org" />);
    const first = screen.getByRole('button', { name: 'How do I reset my password?' });
    expect(first).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands an answer with Enter and collapses it again', async () => {
    const user = userEvent.setup();
    render(<HelpFaq articles={articles} supportEmail="help@example.org" />);
    const first = screen.getByRole('button', { name: 'How do I reset my password?' });
    first.focus();
    await user.keyboard('{Enter}');
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Use Forgot password on sign in.')).toBeVisible();
    await user.keyboard('{Enter}');
    expect(first).toHaveAttribute('aria-expanded', 'false');
  });

  it('filters by search and announces the count', async () => {
    const user = userEvent.setup();
    render(<HelpFaq articles={articles} supportEmail="help@example.org" />);
    await user.type(screen.getByRole('searchbox', { name: 'Search help' }), 'profile');
    expect(screen.getAllByRole('button', { name: /profile/ })).toHaveLength(1);
    expect(screen.getByText('1 result')).toHaveAttribute('aria-live', 'polite');
  });

  it('shows a contact line when nothing matches', async () => {
    const user = userEvent.setup();
    render(<HelpFaq articles={articles} supportEmail="help@example.org" />);
    await user.type(screen.getByRole('searchbox', { name: 'Search help' }), 'zzzz');
    expect(
      screen.getByRole('heading', { name: 'No help articles match "zzzz"' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Check the spelling or try a shorter word. You can also email us.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Email support' })).toHaveAttribute(
      'href',
      'mailto:help@example.org',
    );
  });

  it('uses the mockup search hint and the Still stuck card', () => {
    render(<HelpFaq articles={articles} supportEmail="help@example.org" />);
    expect(screen.getByPlaceholderText('Search help, for example password')).toBeInTheDocument();
    expect(screen.getByText('Still stuck?')).toBeInTheDocument();
    expect(screen.getByText('We reply within 2 working days.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Email help@example.org' })).toHaveAttribute(
      'href',
      'mailto:help@example.org',
    );
  });
});
