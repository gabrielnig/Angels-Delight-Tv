// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MyListExplainer } from './MyListExplainer';

describe('MyListExplainer (S85)', () => {
  it('explains My List and offers Sign in, Create account and Browse', () => {
    render(<MyListExplainer signUpOpen kids={false} />);
    expect(
      screen.getByRole('heading', { name: 'Keep a list that follows you' }),
    ).toBeInTheDocument();
    const next = encodeURIComponent('/my-list');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      `/sign-in?next=${next}`,
    );
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      `/sign-up?next=${next}`,
    );
    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/browse');
  });

  it('hides Create account when sign up is closed', () => {
    render(<MyListExplainer signUpOpen={false} kids={false} />);
    expect(screen.queryByRole('link', { name: 'Create account' })).toBeNull();
  });

  it('asks a child to get a grown-up and shows no account links in Kids mode', () => {
    render(<MyListExplainer signUpOpen kids />);
    expect(
      screen.getByText(
        'Ask a grown-up to sign in so you can keep a list that follows you on every device.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Create account' })).toBeNull();
  });
});
