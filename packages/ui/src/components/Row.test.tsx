import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Row } from './Row';

function setScroll(
  list: HTMLElement,
  values: { scrollLeft: number; scrollWidth: number; clientWidth: number },
) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(list, key, { configurable: true, value, writable: true });
  }
  list.scrollBy = vi.fn() as unknown as typeof list.scrollBy;
  fireEvent.scroll(list);
}

const cards = [1, 2, 3, 4, 5, 6].map((n) => (
  <a key={n} href={`/t/${n}`}>
    Card {n}
  </a>
));

describe('Row', () => {
  it('is a labelled section with a heading and a list of cards', () => {
    render(<Row title="Learn a skill">{cards}</Row>);
    const section = screen.getByRole('region', { name: 'Learn a skill' });
    expect(section).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Learn a skill', level: 2 })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('shows a See all link for category rows', () => {
    render(
      <Row title="Health" seeAllHref="/browse/health">
        {cards}
      </Row>,
    );
    expect(screen.getByRole('link', { name: 'View all Health' })).toHaveAttribute(
      'href',
      '/browse/health',
    );
  });

  it('shows paging arrows only when there is more to scroll and hides the previous arrow at the start', () => {
    render(<Row title="Health">{cards}</Row>);
    const list = screen.getByRole('list');
    setScroll(list, { scrollLeft: 0, scrollWidth: 2000, clientWidth: 800 });
    expect(screen.queryByRole('button', { name: 'Previous titles' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next titles' })).toBeInTheDocument();
    setScroll(list, { scrollLeft: 600, scrollWidth: 2000, clientWidth: 800 });
    expect(screen.getByRole('button', { name: 'Previous titles' })).toBeInTheDocument();
    setScroll(list, { scrollLeft: 1200, scrollWidth: 2000, clientWidth: 800 });
    expect(screen.queryByRole('button', { name: 'Next titles' })).toBeNull();
  });

  it('pages by one visible width minus a card for context', async () => {
    render(<Row title="Health">{cards}</Row>);
    const list = screen.getByRole('list');
    setScroll(list, { scrollLeft: 0, scrollWidth: 2000, clientWidth: 800 });
    Object.defineProperty(list.firstElementChild as HTMLElement, 'offsetWidth', {
      configurable: true,
      value: 160,
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next titles' }));
    expect(list.scrollBy).toHaveBeenCalledWith({ left: 640, behavior: 'smooth' });
  });

  it('pages without smooth scrolling when reduced motion matches', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      render(<Row title="Health">{cards}</Row>);
      const list = screen.getByRole('list');
      setScroll(list, { scrollLeft: 0, scrollWidth: 2000, clientWidth: 800 });
      Object.defineProperty(list.firstElementChild as HTMLElement, 'offsetWidth', {
        configurable: true,
        value: 160,
      });
      await userEvent.setup().click(screen.getByRole('button', { name: 'Next titles' }));
      expect(list.scrollBy).toHaveBeenCalledWith({ left: 640, behavior: 'auto' });
    } finally {
      window.matchMedia = original;
    }
  });

  it('pages by whole cards from the visible column count minus one', async () => {
    render(<Row title="Health">{cards}</Row>);
    const list = screen.getByRole('list');
    setScroll(list, { scrollLeft: 0, scrollWidth: 2000, clientWidth: 800 });
    Object.defineProperty(list.firstElementChild as HTMLElement, 'offsetWidth', {
      configurable: true,
      value: 200,
    });
    const style = {
      getPropertyValue: (name: string) => (name === '--cards-visible' ? '5.3' : ''),
      columnGap: '12px',
    };
    const spy = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue(style as unknown as CSSStyleDeclaration);
    try {
      await userEvent.setup().click(screen.getByRole('button', { name: 'Next titles' }));
    } finally {
      spy.mockRestore();
    }
    expect(list.scrollBy).toHaveBeenCalledWith({ left: 4 * (200 + 12), behavior: 'smooth' });
  });

  it('hides the whole row when empty', () => {
    const { container } = render(<Row title="Continue watching" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows an empty state instead when one is supplied', () => {
    render(<Row title="My List" empty={<p>Your list is empty.</p>} />);
    expect(screen.getByText('Your list is empty.')).toBeInTheDocument();
  });

  it('shows a skeleton row while loading with busy semantics', () => {
    render(<Row title="New" state="loading" skeletonDelayMs={0} />);
    expect(screen.getByRole('region', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByText('Loading New')).toBeInTheDocument();
  });

  it('shows an inline error with retry and keeps the heading', async () => {
    const onRetry = vi.fn();
    render(<Row title="New" state="error" onRetry={onRetry} />);
    expect(screen.getByRole('heading', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load this row.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders View all with the label prop, always in the DOM and focusable', () => {
    render(
      <Row title="Health" viewAllHref="/browse/health" viewAllLabel="See everything">
        {cards}
      </Row>,
    );
    const link = screen.getByRole('link', { name: 'See everything Health' });
    expect(link).toHaveAttribute('href', '/browse/health');
    expect(link).toHaveTextContent('See everything');
    link.focus();
    expect(link).toHaveFocus();
  });

  it('defaults the label to View all', () => {
    render(
      <Row title="New this week" viewAllHref="/browse/new">
        {cards}
      </Row>,
    );
    expect(screen.getByRole('link', { name: 'View all New this week' })).toBeInTheDocument();
  });

  it('marks an external link and opens it safely', () => {
    render(
      <Row title="Partner" viewAllHref="https://example.org/x" viewAllExternal>
        {cards}
      </Row>,
    );
    const link = screen.getByRole('link', { name: /View all Partner/ });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveTextContent('opens another site');
  });

  it('draws no link without a target', () => {
    render(<Row title="Continue learning">{cards}</Row>);
    expect(screen.queryByRole('link', { name: /View all/ })).toBeNull();
  });

  it('still accepts the old seeAllHref prop as View all', () => {
    render(
      <Row title="Health" seeAllHref="/browse/health">
        {cards}
      </Row>,
    );
    expect(screen.getByRole('link', { name: 'View all Health' })).toBeInTheDocument();
  });
});

describe('Row ordered (M44-S09)', () => {
  it('renders an ordered list when asked', () => {
    const { container } = render(
      <Row title="Top 10" ordered>
        {cards}
      </Row>,
    );
    const list = container.querySelector('.ad-row__list')!;
    expect(list.tagName).toBe('OL');
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('stays an unordered list by default', () => {
    const { container } = render(<Row title="Plain">{cards}</Row>);
    expect(container.querySelector('.ad-row__list')!.tagName).toBe('UL');
  });
});
