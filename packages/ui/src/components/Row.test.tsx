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
    expect(screen.getByRole('link', { name: 'See all Health' })).toHaveAttribute(
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
});
