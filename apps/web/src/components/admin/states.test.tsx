// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoAccess } from './states';

afterEach(cleanup);

describe('NoAccess', () => {
  it('names the page and who it is for when it knows', () => {
    render(<NoAccess pageName="Users" roleLabel="Editor" needed="admins" />);
    expect(screen.getByText(/Users is only for admins. Your role is Editor./)).toBeInTheDocument();
    expect(screen.getByText('Error 403')).toBeInTheDocument();
  });
  it('gives a general answer for the 403 page', () => {
    render(<NoAccess roleLabel="Editor" />);
    expect(screen.getByText(/This page is for admins. Your role is Editor./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute(
      'href',
      '/admin',
    );
  });
});
