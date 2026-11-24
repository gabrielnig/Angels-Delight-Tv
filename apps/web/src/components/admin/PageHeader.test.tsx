// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

afterEach(cleanup);

describe('PageHeader', () => {
  it('renders crumbs above the heading with Admin first', () => {
    render(
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Encoding' }]}
        title="Encoding queue"
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const heading = screen.getByRole('heading', { level: 1 });
    expect(nav.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(nav).getAllByRole('link')[0]).toHaveAttribute('href', '/admin');
    expect(within(nav).getByText('Encoding')).toHaveAttribute('aria-current', 'page');
  });
});
