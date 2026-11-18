// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchBox } from './SearchBox';

const suggestions = [
  { type: 'video' as const, label: 'Farm Animals and Their Homes', href: '/title/farm-animals' },
  { type: 'category' as const, label: 'Farming', href: '/browse/farming' },
];

beforeEach(() => {
  window.localStorage.clear();
});

describe('SearchBox', () => {
  it('is a labelled combobox with search keyboard hints', () => {
    render(<SearchBox onSearch={vi.fn()} onNavigate={vi.fn()} loadSuggestions={vi.fn()} />);
    const box = screen.getByRole('combobox', { name: 'Search videos' });
    expect(box).toHaveAttribute('type', 'search');
    expect(box).toHaveAttribute('enterkeyhint', 'search');
    expect(box).toHaveAttribute('aria-expanded', 'false');
  });

  it('debounces suggestions by 250ms and shows them in a listbox', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const loadSuggestions = vi.fn().mockResolvedValue(suggestions);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SearchBox onSearch={vi.fn()} onNavigate={vi.fn()} loadSuggestions={loadSuggestions} />);
    await user.type(screen.getByRole('combobox'), 'farm');
    expect(loadSuggestions).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(260);
    });
    await waitFor(() => expect(loadSuggestions).toHaveBeenCalledTimes(1));
    expect(loadSuggestions).toHaveBeenCalledWith('farm');
    const list = await screen.findByRole('listbox');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-controls', list.id);
    expect(screen.getByRole('option', { name: /Farming, Category/ })).toBeInTheDocument();
  });

  it('moves the active option with arrow keys and navigates with Enter', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(
      <SearchBox
        onSearch={vi.fn()}
        onNavigate={onNavigate}
        loadSuggestions={vi.fn().mockResolvedValue(suggestions)}
        debounceMs={0}
      />,
    );
    const box = screen.getByRole('combobox');
    await user.type(box, 'farm');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}');
    const first = screen.getAllByRole('option')[0]!;
    expect(box).toHaveAttribute('aria-activedescendant', first.id);
    expect(first).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('/title/farm-animals');
  });

  it('closes on Escape without clearing the text', async () => {
    const user = userEvent.setup();
    render(
      <SearchBox
        onSearch={vi.fn()}
        onNavigate={vi.fn()}
        loadSuggestions={vi.fn().mockResolvedValue(suggestions)}
        debounceMs={0}
      />,
    );
    const box = screen.getByRole('combobox');
    await user.type(box, 'farm');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box).toHaveValue('farm');
  });

  it('searches on Enter without an active option and remembers it on this device', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(
      <SearchBox
        onSearch={onSearch}
        onNavigate={vi.fn()}
        loadSuggestions={vi.fn().mockResolvedValue([])}
        debounceMs={0}
      />,
    );
    await user.type(screen.getByRole('combobox'), 'fractions{Enter}');
    expect(onSearch).toHaveBeenCalledWith('fractions');
    expect(JSON.parse(window.localStorage.getItem('ad-recent-searches') ?? '[]')).toEqual([
      'fractions',
    ]);
  });

  it('shows the last 5 recent searches when focused and empty, and can clear them', async () => {
    window.localStorage.setItem(
      'ad-recent-searches',
      JSON.stringify(['a1', 'b2', 'c3', 'd4', 'e5', 'f6']),
    );
    const onSearch = vi.fn();
    const user = userEvent.setup();
    render(<SearchBox onSearch={onSearch} onNavigate={vi.fn()} loadSuggestions={vi.fn()} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByText('Recent searches')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(5);
    expect(screen.getByText('Saved on this device only.')).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'c3' }));
    expect(onSearch).toHaveBeenCalledWith('c3');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(window.localStorage.getItem('ad-recent-searches')).toBe('[]');
  });

  it('has a clear button that empties the field and keeps focus', async () => {
    const user = userEvent.setup();
    render(
      <SearchBox
        onSearch={vi.fn()}
        onNavigate={vi.fn()}
        loadSuggestions={vi.fn().mockResolvedValue([])}
        debounceMs={0}
        initialValue="farming"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('does not break when suggestions fail', async () => {
    const user = userEvent.setup();
    render(
      <SearchBox
        onSearch={vi.fn()}
        onNavigate={vi.fn()}
        loadSuggestions={vi.fn().mockRejectedValue(new Error('x'))}
        debounceMs={0}
      />,
    );
    await user.type(screen.getByRole('combobox'), 'farm');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });

  it('reports the query for live results after the debounce, once per distinct value (M06-S03)', async () => {
    const onLiveQuery = vi.fn();
    const user = userEvent.setup();
    render(
      <SearchBox
        onSearch={vi.fn()}
        onNavigate={vi.fn()}
        loadSuggestions={vi.fn().mockResolvedValue([])}
        onLiveQuery={onLiveQuery}
        initialValue="water"
        debounceMs={20}
      />,
    );
    const box = screen.getByRole('combobox');
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(onLiveQuery).not.toHaveBeenCalled();
    await user.type(box, 's');
    await waitFor(() => expect(onLiveQuery).toHaveBeenCalledWith('waters'));
    expect(onLiveQuery).toHaveBeenCalledTimes(1);
    await user.clear(box);
    await waitFor(() => expect(onLiveQuery).toHaveBeenLastCalledWith(''));
  });

  it('does not run a live query for a single character', async () => {
    const onLiveQuery = vi.fn();
    const user = userEvent.setup();
    render(
      <SearchBox
        onSearch={vi.fn()}
        onNavigate={vi.fn()}
        loadSuggestions={vi.fn().mockResolvedValue([])}
        onLiveQuery={onLiveQuery}
        debounceMs={10}
      />,
    );
    await user.type(screen.getByRole('combobox'), 'a');
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(onLiveQuery).not.toHaveBeenCalled();
  });
});
