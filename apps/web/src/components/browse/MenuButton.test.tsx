// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MenuButton, type MenuOption } from './MenuButton';

const options: MenuOption[] = [
  { value: 'any', label: 'Any length', short: 'Any' },
  { value: 'short', label: 'Under 5 min' },
  { value: 'medium', label: '5 to 15 min' },
  { value: 'long', label: 'Over 15 min' },
];

function setup(over: Partial<React.ComponentProps<typeof MenuButton>> = {}) {
  const onSelect = vi.fn();
  render(
    <MenuButton
      name="Length"
      options={options}
      value="any"
      defaultValue="any"
      onSelect={onSelect}
      {...over}
    />,
  );
  return { onSelect, button: screen.getByRole('button', { name: /^Length:/ }) };
}

function phone(on: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: on && q.includes('max-width'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as never;
}
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).matchMedia;
});

describe('MenuButton on a desktop', () => {
  it('shows the key and the current value, named for screen readers as one phrase', () => {
    const { button } = setup();
    expect(button).toHaveAttribute('aria-label', 'Length: Any length');
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveTextContent('Length:');
    expect(button).toHaveTextContent('Any');
  });

  it('is tinted only when the value is not the default', () => {
    const { button } = setup();
    expect(button).not.toHaveClass('is-set');
  });
  it('is tinted when set', () => {
    const { button } = setup({ value: 'short' });
    expect(button).toHaveClass('is-set');
    expect(button).toHaveAttribute('aria-label', 'Length: Under 5 min');
  });

  it('opens a menu of radio items with the current one checked and focused', async () => {
    const { button } = setup({ value: 'medium' });
    await userEvent.setup().click(button);
    const menu = screen.getByRole('menu', { name: 'Length' });
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items.map((i) => i.textContent)).toEqual(options.map((o) => o.label));
    expect(items[2]).toHaveAttribute('aria-checked', 'true');
    expect(items[2]).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('picking an item applies at once, closes the menu and returns focus to the button', async () => {
    const { button, onSelect } = setup();
    const user = userEvent.setup();
    await user.click(button);
    await user.click(screen.getByRole('menuitemradio', { name: 'Over 15 min' }));
    expect(onSelect).toHaveBeenCalledWith('long');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('moves with arrow keys, Home and End, and selects with Enter', async () => {
    const { button, onSelect } = setup();
    const user = userEvent.setup();
    await user.click(button);
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'Under 5 min' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitemradio', { name: 'Over 15 min' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'Any length' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitemradio', { name: 'Over 15 min' })).toHaveFocus();
    await user.keyboard('{Home}{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('short');
  });

  it('opens from the keyboard with ArrowDown on the button', async () => {
    const { button } = setup();
    button.focus();
    await userEvent.setup().keyboard('{ArrowDown}');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes on Escape without applying and returns focus', async () => {
    const { button, onSelect } = setup();
    const user = userEvent.setup();
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('closes on an outside click and on Tab', async () => {
    const { button } = setup();
    const user = userEvent.setup();
    await user.click(button);
    await user.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    await user.click(button);
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('is greyed and does not open while the results are loading', async () => {
    const { button } = setup({ loading: true, value: 'short' });
    expect(button).toHaveClass('is-loading');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.setup().click(button);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('tells the page when it opens so the phone bar will not hide under it', async () => {
    const onOpenChange = vi.fn();
    const { button } = setup({ onOpenChange });
    const user = userEvent.setup();
    await user.click(button);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

describe('MenuButton on a phone', () => {
  it('opens a bottom sheet with the same choices and applies the tap instantly', async () => {
    phone(true);
    const { button, onSelect } = setup();
    const user = userEvent.setup();
    await user.click(button);
    expect(screen.queryByRole('menu')).toBeNull();
    const dialog = screen.getByRole('dialog', { name: 'Length' });
    const group = within(dialog).getByRole('radiogroup', { name: 'Length' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    for (const r of radios) expect(r).toHaveAttribute('type', 'button');
    // no Apply bar: one tap is the whole job
    expect(within(dialog).queryByRole('button', { name: /apply/i })).toBeNull();
    await user.click(screen.getByRole('radio', { name: '5 to 15 min' }));
    expect(onSelect).toHaveBeenCalledWith('medium');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape and returns focus to the button', async () => {
    phone(true);
    const { button, onSelect } = setup();
    const user = userEvent.setup();
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });
});
