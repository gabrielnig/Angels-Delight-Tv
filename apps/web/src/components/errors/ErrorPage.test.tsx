// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorPage } from './ErrorPage';

const home = { label: 'Back to Home', href: '/' };

describe('ErrorPage (M45-S14, R39)', () => {
  it('has one heading, the description and exactly one action', () => {
    const { container } = render(<ErrorPage title="We could not find that page" description="Old link." action={home} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(container.querySelectorAll('.ad-error a, .ad-error button')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
  });

  it('offers a button action that runs the handler', async () => {
    const onClick = vi.fn();
    render(<ErrorPage title="Something went wrong on our side" description="Try again." action={{ label: 'Try again', onClick }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('moves focus to the heading on mount without a tab stop in the order', () => {
    render(<ErrorPage title="Gone" description="x" action={home} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveAttribute('tabindex', '-1');
    expect(h1).toHaveFocus();
  });

  it('is noindex', () => {
    const { container } = render(<ErrorPage title="Gone" description="x" action={home} />);
    const meta = container.ownerDocument.querySelector('meta[name="robots"]') ?? container.querySelector('meta[name="robots"]');
    expect(meta?.getAttribute('content')).toMatch(/noindex/);
  });

  it('shows the reference and the support email as plain text, never as a link', () => {
    const { container } = render(
      <ErrorPage title="Oops" description="x" reference="AD-4F2A" supportEmail="help@example.org" action={{ label: 'Try again', onClick() {} }} />,
    );
    expect(container).toHaveTextContent('Reference: AD-4F2A');
    expect(container).toHaveTextContent('help@example.org');
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(screen.queryByRole('link', { name: /report/i })).toBeNull();
    expect(container.querySelectorAll('.ad-error a, .ad-error button')).toHaveLength(1);
  });

  it('leaves the support line out when no email is set', () => {
    const { container } = render(<ErrorPage title="Oops" description="x" reference="R1" action={home} />);
    expect(container).not.toHaveTextContent('email');
    expect(container).toHaveTextContent('Reference: R1');
  });

  it('shows a search field that submits to /search and adds no action', () => {
    const { container } = render(<ErrorPage title="Gone" description="x" search action={home} />);
    const field = screen.getByRole('searchbox', { name: 'Search for a lesson' });
    expect(field.closest('form')).toHaveAttribute('action', '/search');
    expect(field).toHaveAttribute('name', 'q');
    expect(container.querySelectorAll('.ad-error a, .ad-error button')).toHaveLength(1);
  });

  it('puts suggestions outside the message block so they never count as actions', () => {
    const { container } = render(
      <ErrorPage title="Gone" description="x" action={home}>
        <ul className="ad-error-suggestions">
          <li>
            <a href="/title/a">A</a>
          </li>
        </ul>
      </ErrorPage>,
    );
    expect(container.querySelectorAll('.ad-error a, .ad-error button')).toHaveLength(1);
    expect(container.querySelectorAll('.ad-error-suggestions a')).toHaveLength(1);
  });
});
