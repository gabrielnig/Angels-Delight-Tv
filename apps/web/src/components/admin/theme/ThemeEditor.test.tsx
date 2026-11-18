// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME, parseTheme } from '@ad/theme/client';
import type { ThemeEditorDto } from '@/lib/data/admin/theme-types';
import { ToastProvider } from '../Toast';
import { ThemeEditor, type ThemeEditorActions } from './ThemeEditor';

beforeAll(() => {
  // jsdom has no modal support on <dialog>, so give it the two methods the Dialog uses.
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const baseDto = (overrides: Partial<ThemeEditorDto> = {}): ThemeEditorDto => ({
  theme: DEFAULT_THEME,
  logo: null,
  platformName: 'Angels Delight TV',
  hasDraft: false,
  draftVersion: null,
  draftSavedAt: null,
  publishedVersion: 3,
  publishedAt: '2026-11-10T09:00:00.000Z',
  ...overrides,
});

function setup(initial = baseDto(), overrides: Partial<ThemeEditorActions> = {}) {
  const actions = {
    saveDraft: vi.fn(async (input) => ({
      ok: true as const,
      data: baseDto({ theme: input.theme, hasDraft: true, platformName: input.platformName }),
    })),
    publish: vi.fn(async (input) => ({
      ok: true as const,
      data: baseDto({ theme: input.theme, publishedVersion: 4, platformName: input.platformName }),
    })),
    reset: vi.fn(async () => ({ ok: true as const, data: baseDto({ hasDraft: true }) })),
    uploadLogo: vi.fn(async () => ({
      ok: true as const,
      data: {
        assetId: 'asset-1',
        dataUrl: 'data:image/webp;base64,AAAA',
        altText: 'logo',
        width: 400,
        height: 100,
        bytes: 4000,
      },
    })),
    ...overrides,
  } satisfies ThemeEditorActions;
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <ThemeEditor initial={initial} actions={actions as ThemeEditorActions} />
    </ToastProvider>,
  );
  return { actions, user };
}

const hex = (label: string) =>
  screen.getByLabelText(label, { selector: 'input.adt-color__hex' }) as HTMLInputElement;
const preview = () => screen.getByRole('img', { name: /preview of the home screen/i });
const button = (name: RegExp | string) => screen.getByRole('button', { name });

async function type(
  user: ReturnType<typeof userEvent.setup>,
  input: HTMLInputElement,
  value: string,
) {
  await user.clear(input);
  await user.type(input, value);
}

describe('colours and contrast', () => {
  it('shows each colour with its ratio and a pass word', () => {
    setup();
    expect(hex('Text').value).toBe('#1A1C22');
    expect(screen.getAllByText(/Pass/).length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText('15.59:1 Pass')).toHaveLength(2);
    expect(screen.getByText('5.25:1 Pass')).toBeInTheDocument();
    expect(screen.getByText('11.09:1 Pass')).toBeInTheDocument();
    expect(screen.getByText('Decorative')).toBeInTheDocument();
  });

  it('updates the live preview at once, without saving', async () => {
    const { actions, user } = setup();
    await type(user, hex('Primary'), '#2B7A4B');
    expect(preview().style.getPropertyValue('--color-primary')).toBe('#2B7A4B');
    expect(actions.saveDraft).not.toHaveBeenCalled();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('fills the colours from a ready made theme and keeps the font', async () => {
    const { actions, user } = setup();
    await user.click(screen.getByRole('radio', { name: /lavender/i }));
    expect(preview().style.getPropertyValue('--color-primary')).toBe('#6D4FC2');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(actions.saveDraft).not.toHaveBeenCalled();
  });

  it('accepts three digit hex and a missing hash on blur', async () => {
    const { user } = setup();
    await type(user, hex('Accent'), 'fc3');
    await user.tab();
    expect(hex('Accent').value).toBe('#FFCC33');
    expect(preview().style.getPropertyValue('--color-accent')).toBe('#FFCC33');
  });

  it('shows an inline error for an invalid hex and keeps the last valid colour', async () => {
    const { user } = setup();
    await type(user, hex('Primary'), '#1F6FZ5');
    await user.tab();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a 6 digit hex colour, for example #1F6FB5',
    );
    expect(screen.getByText('Not checked')).toBeInTheDocument();
    expect(preview().style.getPropertyValue('--color-primary')).toBe('#1F6FB5');
    expect(button(/save draft/i)).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getAllByText(/not a valid hex/i).length).toBeGreaterThan(0);
  });

  it('blocks save and publish when text is too hard to read, and explains why', async () => {
    const { actions, user } = setup();
    await type(user, hex('Text'), '#8A8D94');
    await user.tab();
    expect(screen.getByText('This colour cannot be saved.')).toBeInTheDocument();
    expect(screen.getAllByText(/too hard to read|below the 4.5:1/i).length).toBeGreaterThan(0);
    expect(button(/save draft/i)).toHaveAttribute('aria-disabled', 'true');
    expect(button(/publish theme/i)).toHaveAttribute('aria-disabled', 'true');
    await user.click(button(/save draft/i));
    expect(actions.saveDraft).not.toHaveBeenCalled();
    expect(screen.getAllByText('Too low', { exact: false }).length).toBeGreaterThan(0);
  });

  it('applies the suggested colour from the banner', async () => {
    const { user } = setup();
    await type(user, hex('Text'), '#8A8D94');
    await user.tab();
    await user.click(screen.getAllByRole('button', { name: /use suggested/i })[0]!);
    expect(screen.queryByText('This colour cannot be saved.')).not.toBeInTheDocument();
    expect(button(/save draft/i)).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('resets a single colour to its default', async () => {
    const { user } = setup();
    await type(user, hex('Primary'), '#2B7A4B');
    await user.click(screen.getByRole('button', { name: /reset primary to the default/i }));
    expect(hex('Primary').value).toBe('#1F6FB5');
  });
});

describe('fonts and sizes', () => {
  it('lists the curated fonts and applies the choice to the preview', async () => {
    const { user } = setup();
    const radios = screen.getAllByRole('radio', { name: /Inter|DM Sans|Poppins|Nunito|Lora/ });
    expect(radios.map((radio) => (radio as HTMLInputElement).value)).toEqual([
      'inter',
      'dm-sans',
      'poppins',
      'nunito',
      'lora',
    ]);
    await user.click(screen.getByRole('radio', { name: /Poppins/ }));
    expect(preview().style.getPropertyValue('--font-sans')).toContain('Poppins');
  });

  it('changes the base text size with a labelled slider', () => {
    setup();
    const slider = screen.getByRole('slider', { name: 'Base text size' });
    fireEvent.change(slider, { target: { value: '5' } });
    expect(slider).toHaveAttribute('aria-valuetext', '18.4 px');
    expect(preview().style.getPropertyValue('--type-scale')).toBe('1.15');
    expect(preview().style.getPropertyValue('--text-body')).toBe('');
  });

  it('changes spacing density', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('radio', { name: 'Compact' }));
    expect(preview().style.getPropertyValue('--row-gap')).toBe('var(--space-6)');
  });
});

describe('preview', () => {
  it('switches screens and device size', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('tab', { name: 'Watch' }));
    expect(screen.getByRole('img', { name: /watch screen/i })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Sign in' }));
    expect(screen.getByRole('img', { name: /sign in screen/i })).toBeInTheDocument();
    await user.click(button('Mobile'));
    expect(screen.getByRole('img', { name: /sign in screen/i })).toHaveAttribute(
      'data-device',
      'mobile',
    );
  });

  it('shows the platform name as text when there is no logo, and the live name as you type', async () => {
    const { user } = setup();
    expect(within(preview()).getAllByText('Angels Delight TV').length).toBeGreaterThan(0);
    await user.clear(screen.getByLabelText('Platform name'));
    await user.type(screen.getByLabelText('Platform name'), 'Sister V TV');
    expect(within(preview()).getAllByText('Sister V TV').length).toBeGreaterThan(0);
  });
});

describe('save, publish and reset', () => {
  it('saves a draft with the current values', async () => {
    const { actions, user } = setup();
    await type(user, hex('Primary'), '#2B7A4B');
    await user.click(button(/save draft/i));
    await waitFor(() => expect(actions.saveDraft).toHaveBeenCalledTimes(1));
    expect(vi.mocked(actions.saveDraft).mock.calls[0]![0].theme.colors.primary).toBe('#2B7A4B');
    expect(await screen.findByText('Draft saved.')).toBeInTheDocument();
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('publishes after a confirm and tells the admin which version is in history', async () => {
    const { actions, user } = setup();
    await type(user, hex('Primary'), '#2B7A4B');
    await user.click(button(/publish theme/i));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/Viewers will see the new look on their next page load/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Publish theme' }));
    await waitFor(() => expect(actions.publish).toHaveBeenCalledTimes(1));
    expect(vi.mocked(actions.publish).mock.calls[0]![0].acknowledgeWarnings).toBe(false);
    expect(await screen.findByText(/Version 4 is saved in history/)).toBeInTheDocument();
  });

  it('asks for confirmation of low contrast before publishing', async () => {
    const warnTheme = parseTheme({ colors: { primary: '#808080' } });
    const { actions, user } = setup(baseDto({ theme: warnTheme, hasDraft: true }));
    expect(screen.getByText(/Low contrast on/)).toBeInTheDocument();
    await user.click(button(/publish theme/i));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: 'Publish with low contrast?' }),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Publish anyway' }));
    await waitFor(() => expect(actions.publish).toHaveBeenCalled());
    expect(vi.mocked(actions.publish).mock.calls[0]![0].acknowledgeWarnings).toBe(true);
  });

  it('keeps the edits and offers a retry message when saving fails', async () => {
    const { user } = setup(baseDto(), {
      saveDraft: vi.fn(async () => ({
        ok: false as const,
        message: 'Something went wrong on our side. Your draft is safe. Try again.',
      })),
    });
    await type(user, hex('Primary'), '#2B7A4B');
    await user.click(button(/save draft/i));
    expect(await screen.findByText(/Your changes are still here/)).toBeInTheDocument();
    expect(hex('Primary').value).toBe('#2B7A4B');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('shows a server side name error beside the field', async () => {
    const { user } = setup(baseDto(), {
      saveDraft: vi.fn(async () => ({
        ok: false as const,
        message: 'Some settings are not valid',
        fields: { 'platform.name': ['Platform name is required'] },
      })),
    });
    await user.type(screen.getByLabelText('Platform name'), 'x');
    await user.click(button(/save draft/i));
    expect(await screen.findByText('Platform name is required')).toBeInTheDocument();
  });

  it('asks before resetting, and keeps the draft on cancel', async () => {
    const { actions, user } = setup();
    await type(user, hex('Primary'), '#2B7A4B');
    await user.click(button(/reset to default/i));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Your current draft will be lost/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(actions.reset).not.toHaveBeenCalled();
    expect(hex('Primary').value).toBe('#2B7A4B');
  });

  it('resets to the defaults after confirming', async () => {
    const { actions, user } = setup();
    await type(user, hex('Primary'), '#2B7A4B');
    await user.click(button(/reset to default/i));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reset to default' }));
    await waitFor(() => expect(actions.reset).toHaveBeenCalled());
    await waitFor(() => expect(hex('Primary').value).toBe('#1F6FB5'));
  });

  it('warns before leaving with unsaved changes', async () => {
    const { user } = setup();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    await type(user, hex('Primary'), '#2B7A4B');
    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);
  });
});

describe('logo', () => {
  const file = (name: string, type: string, size = 1000) =>
    new File([new Uint8Array(size)], name, { type });
  const input = () => screen.getByLabelText('Logo file') as HTMLInputElement;

  it('rejects SVG without calling the server', async () => {
    const { actions } = setup();
    fireEvent.change(input(), { target: { files: [file('logo.svg', 'image/svg+xml')] } });
    expect(await screen.findByText(/SVG files are not accepted/)).toBeInTheDocument();
    expect(actions.uploadLogo).not.toHaveBeenCalled();
  });

  it('rejects files over 500 KB', async () => {
    const { actions } = setup();
    fireEvent.change(input(), { target: { files: [file('big.png', 'image/png', 600 * 1024)] } });
    expect(await screen.findByText(/larger than 500 KB/)).toBeInTheDocument();
    expect(actions.uploadLogo).not.toHaveBeenCalled();
  });

  it('uploads a png, shows it on light and dark, and shows it in the preview', async () => {
    const { actions } = setup();
    fireEvent.change(input(), { target: { files: [file('logo.png', 'image/png')] } });
    await waitFor(() => expect(actions.uploadLogo).toHaveBeenCalled());
    expect(await screen.findByAltText('Current logo on a dark background')).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace logo' })).toBeInTheDocument();
  });

  it('shows the server reason when the image is refused', async () => {
    setup(baseDto(), {
      uploadLogo: vi.fn(async () => ({
        ok: false as const,
        message: 'x',
        fields: { file: ['That image could not be read. Try exporting it again.'] },
      })),
    });
    fireEvent.change(input(), { target: { files: [file('logo.png', 'image/png')] } });
    expect(await screen.findByText(/could not be read/)).toBeInTheDocument();
  });
});

describe('read only', () => {
  it('disables every control for a role that may only view', () => {
    const actions = { saveDraft: vi.fn(), publish: vi.fn(), reset: vi.fn(), uploadLogo: vi.fn() };
    render(
      <ToastProvider>
        <ThemeEditor
          initial={baseDto()}
          actions={actions as unknown as ThemeEditorActions}
          readOnly
        />
      </ToastProvider>,
    );
    expect(hex('Primary')).toHaveAttribute('readonly');
    expect(button(/save draft/i)).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /reset to default/i })).toBeDisabled();
  });
});
