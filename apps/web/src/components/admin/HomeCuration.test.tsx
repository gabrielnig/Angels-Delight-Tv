// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultHome } from '@/lib/data/admin/home-rules';
import { getStore } from '@/lib/data/admin/store';
import { HomeCuration } from './HomeCuration';
import { ToastProvider } from './Toast';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);

const s = structuredClone(getStore());
const ok = () => vi.fn().mockResolvedValue({ ok: true });
const view = (canCurate = true, saveDraft = ok()) => {
  const actions = { saveDraft, publish: ok(), restore: ok() };
  const state = {
    draft: defaultHome(),
    published: defaultHome(),
    previous: null,
    publishedAt: null,
  };
  render(
    <ToastProvider>
      <HomeCuration
        state={state}
        videos={s.videos}
        series={s.series}
        categories={s.categories}
        canCurate={canCurate}
        actions={actions}
      />
    </ToastProvider>,
  );
  return actions;
};

describe('HomeCuration', () => {
  it('starts clean with publish and save off', () => {
    view();
    expect(screen.getByText('Published and up to date')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
  it('marks changes, updates the preview and saves a draft', async () => {
    const a = view();
    fireEvent.click(screen.getByLabelText('Move My List up'));
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(a.saveDraft).toHaveBeenCalledTimes(1));
  });
  it('hides a row from the preview', () => {
    view();
    expect(screen.getAllByText('New this week').length).toBe(2);
    fireEvent.click(screen.getByRole('switch', { name: 'Show New this week' }));
    expect(screen.getAllByText('New this week').length).toBe(1);
  });
  it('locks controls without curate rights', () => {
    view(false);
    expect((screen.getByRole('button', { name: 'Add section' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
  it('says Home shows the five newest titles when no hero is chosen and lists them in the preview', () => {
    view();
    expect(
      screen.getByText('No hero titles chosen. Home shows your 5 newest titles.'),
    ).toBeTruthy();
    expect(screen.getByText(/Newest titles are used until you choose hero titles/)).toBeTruthy();
  });
});

const sections = () => screen.getByRole('region', { name: 'Sections' });
const names = () =>
  within(sections())
    .getAllByRole('listitem')
    .map((li) => li.getAttribute('data-section'));
const open = (name: string) =>
  fireEvent.click(within(sections()).getByRole('button', { name: `Edit ${name}` }));
const editor = () => screen.getByRole('region', { name: /^Edit section/ });
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

describe('sections list (M41-S06)', () => {
  it('shows the count against the limit and a View all line on every section', () => {
    view();
    expect(within(sections()).getByText('4 of 12')).toBeTruthy();
    expect(within(sections()).getByText('New · View all: Automatic, /browse/new')).toBeTruthy();
    expect(within(sections()).getByText('Continue learning · No View all link')).toBeTruthy();
  });

  it('adds a section of each type with a default name, then opens its editor', () => {
    const cases: Array<[string, string]> = [
      ['Manual list', 'Maths week'],
      ['New', 'New'],
      ['Popular (most watched)', 'Popular'],
      ['Trending now', 'Trending now'],
      ['Top 10', 'Top 10'],
      ['Most liked', 'Most liked'],
      ['Each category (automatic)', 'Browse by subject'],
      ['All series (automatic)', 'Series'],
    ];
    view();
    for (const [label, name] of cases) {
      fireEvent.click(screen.getByRole('button', { name: 'Add section' }));
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getAllByRole('radio').length).toBe(10);
      fireEvent.click(within(dialog).getByRole('radio', { name: new RegExp(label.replace(/[()]/g, '\\$&')) }));
      if (label === 'Manual list') type(within(dialog).getByLabelText('Section name'), name);
      expect((within(dialog).getByLabelText('Section name') as HTMLInputElement).value).toBe(name);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add section' }));
      expect((within(editor()).getByLabelText('Section name') as HTMLInputElement).value).toBe(name);
    }
    expect(within(sections()).getByText('12 of 12')).toBeTruthy();
  });

  it('offers the fallback tick and title only on a Popular section', () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: /^Popular/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add section' }));
    expect(within(editor()).queryByLabelText('Title when it falls back')).toBeNull();
    fireEvent.click(within(editor()).getByRole('switch', { name: 'Fall back to newest' }));
    type(within(editor()).getByLabelText('Title when it falls back'), 'Fresh picks');
    expect((within(editor()).getByLabelText('Title when it falls back') as HTMLInputElement).value).toBe('Fresh picks');
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: /^Top 10/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add section' }));
    expect(within(editor()).queryByRole('switch', { name: 'Fall back to newest' })).toBeNull();
  });

  it('needs a source for a category section and takes its name as the default', () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: /^Category/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add section' }));
    expect(screen.getByText('Choose a category.')).toBeTruthy();
    const first = s.categories[0]!;
    type(within(dialog).getByLabelText('Category'), first.id);
    expect((within(dialog).getByLabelText('Section name') as HTMLInputElement).value).toBe(first.name);
  });

  it('renames in place: Enter saves, Escape cancels, an empty name is refused', () => {
    view();
    const rename = () => within(sections()).getByRole('button', { name: 'Rename New this week' });
    fireEvent.click(rename());
    let input = within(sections()).getByRole('textbox', { name: 'Section name' });
    type(input, 'Fresh picks');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(within(sections()).getByText('Fresh picks')).toBeTruthy();

    fireEvent.click(within(sections()).getByRole('button', { name: 'Rename Fresh picks' }));
    input = within(sections()).getByRole('textbox', { name: 'Section name' });
    type(input, 'Nope');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(within(sections()).getByText('Fresh picks')).toBeTruthy();
    expect(within(sections()).queryByText('Nope')).toBeNull();

    fireEvent.click(within(sections()).getByRole('button', { name: 'Rename Fresh picks' }));
    input = within(sections()).getByRole('textbox', { name: 'Section name' });
    type(input, '  ');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(within(sections()).getByText('Give the section a name')).toBeTruthy();
    expect(within(sections()).getByRole('textbox', { name: 'Section name' })).toBeTruthy();
  });

  it('shows how many characters of the name limit are used while renaming', () => {
    view();
    fireEvent.click(within(sections()).getByRole('button', { name: 'Rename New this week' }));
    expect(within(sections()).getByText('13 of 60')).toBeTruthy();
  });

  it('reorders with the buttons and announces the move without losing focus', () => {
    view();
    const before = names();
    const down = within(sections()).getByRole('button', { name: 'Move My List down' });
    down.focus();
    fireEvent.click(down);
    const after = names();
    expect(after[2]).toBe(before[1]);
    expect(screen.getByRole('status', { name: 'Section changes' }).textContent).toBe(
      'Moved My List to position 3',
    );
    expect(document.activeElement).toBe(down);
  });

  it('reorders by dragging a handle onto another section', () => {
    view();
    const before = names();
    const handle = within(sections()).getByRole('button', { name: 'Drag to reorder Most watched this week' });
    const target = within(sections()).getByText('Continue learning', { selector: 'strong' }).closest('li')!;
    const data = { setData: vi.fn(), getData: () => before[3]!, effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(handle.closest('li')!, { dataTransfer: data });
    fireEvent.dragOver(target, { dataTransfer: data });
    fireEvent.drop(target, { dataTransfer: data });
    expect(names()[0]).toBe(before[3]);
    expect(screen.getByRole('status', { name: 'Section changes' }).textContent).toBe(
      'Moved Most watched this week to position 1',
    );
  });

  it('removes a section after a confirmation that says what goes', () => {
    view();
    open('New this week');
    fireEvent.click(within(editor()).getByRole('button', { name: 'Remove section' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toMatch(/New this week/);
    expect(dialog.textContent).toMatch(/Titles stay in your library/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove section' }));
    expect(within(sections()).queryByText('New this week')).toBeNull();
  });

  it('will not remove a built in section and says why', () => {
    view();
    open('Continue learning');
    expect((within(editor()).getByRole('button', { name: 'Remove section' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(editor()).getByText('Built in sections can be hidden but not removed.')).toBeTruthy();
  });

  it('explains the limit when Add section is pressed at twelve', () => {
    const state = { draft: defaultHome(), published: defaultHome(), previous: null, publishedAt: null };
    const rows = Array.from({ length: 12 }, (_, i) => ({ ...state.draft.rows[1]!, id: `n${i}`, name: `Section ${i}` }));
    state.draft = { heroIds: [], rows };
    render(
      <ToastProvider>
        <HomeCuration state={state} videos={s.videos} series={s.series} categories={s.categories} canCurate actions={{ saveDraft: ok(), publish: ok(), restore: ok() }} />
      </ToastProvider>,
    );
    const add = screen.getByRole('button', { name: 'Add section' }) as HTMLButtonElement;
    expect(add.disabled).toBe(false);
    fireEvent.click(add);
    expect(screen.getByText(/Home can hold 12 sections. Hide or remove one to add another./)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('section editor (M41-S07, S08)', () => {
  it('shows what an automatic View all opens, in words', () => {
    view();
    open('New this week');
    expect(within(editor()).getByText('All new videos (/browse/new)', { exact: false })).toBeTruthy();
    expect(within(editor()).getByRole('radio', { name: /Automatic/ })).toBeChecked();
  });

  it('checks a custom link and blocks Publish until it is valid', () => {
    view();
    open('New this week');
    fireEvent.click(within(editor()).getByRole('radio', { name: /Custom link/ }));
    const field = within(editor()).getByLabelText('Link');
    type(field, 'browse/maths');
    expect(within(editor()).getByText('Use a path on this site or an https link')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Publish changes' }) as HTMLButtonElement).disabled).toBe(true);
    type(field, '/browse/maths');
    expect(within(editor()).queryByText('Use a path on this site or an https link')).toBeNull();
    expect((screen.getByRole('button', { name: 'Publish changes' }) as HTMLButtonElement).disabled).toBe(false);
    expect(within(sections()).getByText('New · View all: Custom, /browse/maths', { exact: false })).toBeTruthy();
  });

  it('turns the link off with None', () => {
    view();
    open('New this week');
    fireEvent.click(within(editor()).getByRole('radio', { name: /None/ }));
    expect(within(sections()).getByText('New · No View all link', { exact: false })).toBeTruthy();
  });

  it('sets the minimum titles and refuses values outside 1 to 20', () => {
    view();
    open('Most watched this week');
    const field = within(editor()).getByLabelText('Minimum titles to show') as HTMLInputElement;
    type(field, '7');
    expect(within(editor()).getByText(/Hidden while it has fewer than 7 titles/)).toBeTruthy();
    type(field, '0');
    expect(within(editor()).getByText('Use a minimum from 1 to 20 titles')).toBeTruthy();
    fireEvent.click(within(editor()).getByRole('button', { name: 'More titles' }));
    expect(field.value).toBe('8');
  });

  it('switches Kids visibility with a word beside the switch', () => {
    view();
    open('New this week');
    const sw = within(editor()).getByRole('switch', { name: 'Show on Kids profiles' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(within(editor()).getByRole('switch', { name: 'Show on Kids profiles' }).getAttribute('aria-checked')).toBe('false');
    expect(within(sections()).getAllByText('Adults').length).toBeGreaterThan(0);
  });

  it('sends the new fields when saving a draft', async () => {
    const a = view();
    open('New this week');
    fireEvent.click(within(editor()).getByRole('radio', { name: /None/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(a.saveDraft).toHaveBeenCalledTimes(1));
    const saved = a.saveDraft.mock.calls[0]![0].rows.find((r: { name: string }) => r.name === 'New this week');
    expect(saved.viewAllMode).toBe('none');
  });

  it('keeps edits on screen when saving fails and offers Retry', async () => {
    const save = vi.fn().mockResolvedValueOnce({ ok: false, error: 'offline' }).mockResolvedValue({ ok: true });
    view(true, save);
    open('New this week');
    fireEvent.click(within(editor()).getByRole('radio', { name: /None/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('We could not save your changes.')).toBeTruthy();
    expect(screen.getByText('Your edits are still here. Check your connection and try again.')).toBeTruthy();
    expect(within(sections()).getByText('New · No View all link', { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('We could not save your changes.')).toBeNull());
  });

  it('notes a duplicate name but allows it', () => {
    view();
    open('New this week');
    fireEvent.click(within(sections()).getByRole('button', { name: 'Rename Most watched this week' }));
    const input = within(sections()).getByRole('textbox', { name: 'Section name' });
    type(input, 'New this week');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(within(editor()).getByText(/Another section is called New this week. That is allowed./)).toBeTruthy();
  });
});

describe('restore launch defaults (M41-S09)', () => {
  it('asks first, then puts the launch sections in the draft without saving', () => {
    const a = view();
    fireEvent.click(screen.getByRole('button', { name: 'Restore launch defaults' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toMatch(/Your sections and their order are replaced/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore launch defaults' }));
    expect(within(sections()).getByText('6 of 12')).toBeTruthy();
    expect(within(sections()).getByText('Browse by subject')).toBeTruthy();
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect(a.saveDraft).not.toHaveBeenCalled();
  });
  it('is off without curate rights', () => {
    view(false);
    expect((screen.getByRole('button', { name: 'Restore launch defaults' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('offers the launch sections from the empty state', () => {
    const state = { draft: { heroIds: [], rows: [] }, published: defaultHome(), previous: null, publishedAt: null };
    render(
      <ToastProvider>
        <HomeCuration state={state} videos={s.videos} series={s.series} categories={s.categories} canCurate actions={{ saveDraft: ok(), publish: ok(), restore: ok() }} />
      </ToastProvider>,
    );
    expect(screen.getByText(/Home shows only the hero until you add a section/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Restore launch defaults' }).length).toBe(2);
  });
});

describe('HomeCuration hero text', () => {
  it('shows slide text fields for a chosen hero title and marks the draft changed', () => {
    const state = { draft: defaultHome(), published: defaultHome(), previous: null, publishedAt: null };
    const v = s.videos.find((x) => x.publishState === 'published')!;
    state.draft = { ...state.draft, heroIds: [v.id] };
    state.published = state.draft;
    render(
      <ToastProvider>
        <HomeCuration state={state} videos={s.videos} series={s.series} categories={s.categories} canCurate actions={{ saveDraft: ok(), publish: ok(), restore: ok() }} />
      </ToastProvider>,
    );
    fireEvent.change(screen.getByLabelText(`Headline for ${v.title}`), { target: { value: 'Start here' } });
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });
});

describe('HomeCuration live preview', () => {
  const published = () => s.videos.filter((x) => x.publishState === 'published');
  const mount = (heroIds: string[], heroText = {}, videos = s.videos) => {
    const state = { draft: defaultHome(), published: defaultHome(), previous: null, publishedAt: null };
    state.draft = { ...state.draft, heroIds, heroText };
    state.published = state.draft;
    render(
      <ToastProvider>
        <HomeCuration state={state} videos={videos} series={s.series} categories={s.categories} canCurate actions={{ saveDraft: ok(), publish: ok(), restore: ok() }} />
      </ToastProvider>,
    );
    return within(screen.getByLabelText(/Home preview/));
  };

  it('lists the fallback titles and the number of slides', () => {
    const pane = mount([]);
    expect(pane.getByText(/Newest titles are used/)).toBeTruthy();
    expect(pane.getAllByTestId('preview-slide').length).toBeGreaterThan(1);
  });

  it('shows the editor headline and button label, and a clip badge per slide', () => {
    const [v] = published();
    const withClip = s.videos.map((x) =>
      x.id === v!.id ? { ...x, preview: { state: 'ready' as const, mode: 'auto' as const, startMs: null, note: null } } : x,
    );
    const pane = mount([v!.id], { [v!.id]: { headline: 'Start here', buttonLabel: 'Begin' } }, withClip);
    expect(pane.getByText('Start here')).toBeTruthy();
    expect(pane.getByText('Button: Begin')).toBeTruthy();
    expect(pane.getByText('Clip plays')).toBeTruthy();
  });

  it('says why a slide has no clip', () => {
    const [v] = published();
    const off = s.videos.map((x) =>
      x.id === v!.id ? { ...x, preview: { state: 'ready' as const, mode: 'off' as const, startMs: null, note: null } } : x,
    );
    const pane = mount([v!.id], {}, off);
    expect(pane.getByText('Clip off')).toBeTruthy();
  });

  it('shows each section View all link', () => {
    const pane = mount([]);
    expect(pane.getAllByText(/View all: Automatic, \/browse\//).length).toBeGreaterThan(0);
  });
});
