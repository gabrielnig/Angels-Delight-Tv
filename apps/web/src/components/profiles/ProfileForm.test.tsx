// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Profile } from '../../lib/data';
import { MaturityLabelsProvider } from '../../lib/maturity-context';
import { ProfileForm } from './ProfileForm';

const emeka: Profile = {
  id: 'p2',
  name: 'Emeka',
  kids: false,
  owner: false,
  language: 'en',
  autoplayNext: true,
};
const amina: Profile = {
  id: 'p3',
  name: 'Amina',
  kids: true,
  owner: false,
  language: 'en',
  autoplayNext: false,
};

describe('ProfileForm create', () => {
  it('has a labelled name field with a counter and a Kids switch with its explanation', () => {
    render(<ProfileForm onSave={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByLabelText(/Name \(required\)/)).toBeInTheDocument();
    expect(screen.getByText('0/20')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Kids profile' })).toBeInTheDocument();
    expect(screen.getByText(/leaving Kids mode needs your account password/)).toBeInTheDocument();
  });

  it('counts characters and caps the name at 20', async () => {
    const user = userEvent.setup();
    render(<ProfileForm onSave={vi.fn()} onDone={vi.fn()} />);
    await user.type(screen.getByLabelText(/Name/), 'Ada');
    expect(screen.getByText('3/20')).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toHaveAttribute('maxlength', '20');
  });

  it('requires a name and focuses the field', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<ProfileForm onSave={onSave} onDone={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Create profile' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Type a name for this profile.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toHaveFocus();
  });

  it('offers a picture choice as a radio group with the keyboard', async () => {
    const user = userEvent.setup();
    render(<ProfileForm onSave={vi.fn()} onDone={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: 'Picture' });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(12);
    await user.click(radios[2]!);
    expect(radios[2]).toBeChecked();
  });

  it('names each picture and sends the chosen avatar id', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ProfileForm onSave={onSave} onDone={vi.fn()} />);
    await user.type(screen.getByLabelText(/Name/), 'Zainab');
    await user.click(screen.getByRole('radio', { name: 'Drum' }));
    await user.click(screen.getByRole('button', { name: 'Create profile' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ avatarId: 'drum' }));
  });

  it('starts on the saved avatar when editing', () => {
    render(
      <ProfileForm profile={{ ...emeka, avatarId: 'fish' }} onSave={vi.fn()} onDone={vi.fn()} />,
    );
    expect(screen.getByRole('radio', { name: 'Fish' })).toBeChecked();
  });

  it('saves the values and continues', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<ProfileForm onSave={onSave} onDone={onDone} />);
    await user.type(screen.getByLabelText(/Name/), 'Zainab');
    await user.click(screen.getByRole('switch', { name: 'Kids profile' }));
    await user.click(screen.getByRole('button', { name: 'Create profile' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Zainab', kids: true }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('shows a duplicate name error on the field and returns focus', async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        onSave={vi.fn().mockResolvedValue({ ok: false, reason: 'duplicate' })}
        onDone={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText(/Name/), 'Amina');
    await user.click(screen.getByRole('button', { name: 'Create profile' }));
    expect(
      await screen.findByText('You already have a profile called Amina. Choose a different name.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toHaveFocus();
  });

  it('disables create with a reason when the limit is reached', () => {
    render(<ProfileForm onSave={vi.fn()} onDone={vi.fn()} limitReached />);
    expect(screen.getByText('You have reached 5 profiles.')).toBeInTheDocument();
    expect(screen.getByText('Delete a profile before adding another.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create profile' })).toBeDisabled();
  });

  it('cancels back to the picker', () => {
    render(<ProfileForm onSave={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/profiles/manage',
    );
  });
});

describe('ProfileForm edit', () => {
  it('shows language, autoplay and delete for an existing profile', () => {
    render(<ProfileForm profile={emeka} onSave={vi.fn()} onDone={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Edit profile' })).toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Autoplay next video' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete profile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('asks for the account password before a kids profile becomes an adult profile', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ProfileForm profile={amina} onSave={onSave} onDone={vi.fn()} onDelete={vi.fn()} />);
    await user.click(screen.getByRole('switch', { name: 'Kids profile' }));
    expect(screen.getByLabelText(/Account password/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByText('Enter your account password to make this an adult profile.'),
    ).toBeInTheDocument();
  });

  it('confirms deletion naming the profile and the consequence', async () => {
    const onDelete = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ProfileForm profile={emeka} onSave={vi.fn()} onDone={vi.fn()} onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: 'Delete profile' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Emeka?' });
    expect(dialog).toHaveTextContent(
      "This permanently deletes Emeka's watch history, My List and settings. This cannot be undone.",
    );
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete profile' }));
    await user.click(screen.getAllByRole('button', { name: 'Delete profile' }).at(-1)!);
    expect(onDelete).toHaveBeenCalled();
  });

  it('blocks deleting the last adult profile and explains', async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        profile={emeka}
        onSave={vi.fn()}
        onDone={vi.fn()}
        onDelete={vi.fn()}
        lastAdult
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Delete profile' }));
    expect(screen.getByRole('dialog', { name: 'You cannot delete Emeka' })).toHaveTextContent(
      'Emeka is the last adult profile on this account. Make another profile an adult profile first, then try again.',
    );
  });

  it('keeps the dialog open with an error when delete fails', async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        profile={emeka}
        onSave={vi.fn()}
        onDone={vi.fn()}
        onDelete={vi.fn().mockRejectedValue(new Error('x'))}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Delete profile' }));
    await user.click(screen.getAllByRole('button', { name: 'Delete profile' }).at(-1)!);
    expect(
      await screen.findByText('We could not delete this profile. Try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('ProfileForm suggested name and unsaved changes', () => {
  it('pre-fills the suggested name, editable', async () => {
    const user = userEvent.setup();
    render(<ProfileForm suggestedName="Adaeze" onSave={vi.fn()} onDone={vi.fn()} />);
    const field = screen.getByLabelText(/Name/);
    expect(field).toHaveValue('Adaeze');
    await user.type(field, 'x');
    expect(field).toHaveValue('Adaezex');
  });

  it('leaves at once when nothing changed', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<ProfileForm profile={emeka} onSave={vi.fn()} onDone={onDone} />);
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/profiles/manage',
    );
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks to discard or keep editing when there are unsaved changes', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<ProfileForm profile={emeka} onSave={vi.fn()} onDone={onDone} />);
    await user.type(screen.getByLabelText(/Name/), 'x');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    const dialog = screen.getByRole('dialog', { name: 'Discard your changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onDone).not.toHaveBeenCalled();
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('warns the browser before the tab closes with unsaved changes', async () => {
    const user = userEvent.setup();
    render(<ProfileForm profile={emeka} onSave={vi.fn()} onDone={vi.fn()} />);
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    await user.type(screen.getByLabelText(/Name/), 'x');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});

describe('ProfileForm PIN (M03-S12)', () => {
  it('sets a four digit PIN and needs the account password for it', async () => {
    const onSave = vi.fn(async () => ({ ok: true as const }));
    const user = userEvent.setup();
    render(<ProfileForm profile={emeka} onSave={onSave} onDone={vi.fn()} />);
    const pin = screen.getByLabelText(/^PIN/);
    expect(pin).toHaveAttribute('inputmode', 'numeric');
    await user.type(pin, '48a21');
    expect(pin).toHaveValue('4821');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText('Enter your account password to change the PIN.'),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Account password/), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ pin: '4821', password: 'secret-pass' }),
    );
  });

  it('removes an existing PIN', async () => {
    const onSave = vi.fn(async () => ({ ok: true as const }));
    const user = userEvent.setup();
    render(<ProfileForm profile={{ ...emeka, hasPin: true }} onSave={onSave} onDone={vi.fn()} />);
    await user.click(screen.getByRole('switch', { name: 'Remove the PIN' }));
    await user.type(screen.getByLabelText(/Account password/), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ pin: null }));
  });

  it('shows no PIN field on a Kids profile', () => {
    render(<ProfileForm profile={amina} onSave={vi.fn()} onDone={vi.fn()} />);
    expect(screen.queryByLabelText(/^PIN/)).not.toBeInTheDocument();
  });
});

describe('ProfileForm language options (M46)', () => {
  it('language options follow the enabled list', () => {
    render(
      <ProfileForm
        profile={{ ...emeka, language: 'yo' }}
        languages={['en', 'yo', 'ha']}
        onSave={vi.fn()}
        onDone={vi.fn()}
      />,
    );
    const options = within(screen.getByLabelText('Language'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual(['English', 'Yorùbá', 'Hausa']);
  });
  it('offers English only by default', () => {
    render(<ProfileForm profile={emeka} onSave={vi.fn()} onDone={vi.fn()} />);
    expect(
      within(screen.getByLabelText('Language'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['English']);
  });
});

describe('ProfileForm maturity limit (S126)', () => {
  const teen: Profile = { ...emeka, maxMaturityRank: 2 };
  const limit = () => screen.getByLabelText('Allow titles rated up to');

  it('shows the limit with a plain meaning beside each label', () => {
    render(<ProfileForm profile={teen} onSave={vi.fn()} onDone={vi.fn()} />);
    expect(limit()).toHaveValue('2');
    expect(
      within(limit())
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      'G, all ages',
      'PG, parental guidance',
      '12, ages 12 and up',
      '15, ages 15 and up',
      '18, adults only',
    ]);
    expect(
      screen.getByText(/hidden from this profile everywhere: Home, search, My List and playback/i),
    ).toBeInTheDocument();
  });

  it('uses only the label when the site changed the labels', () => {
    render(
      <MaturityLabelsProvider labels={['All', '7+', '13+', '16+', '18+']}>
        <ProfileForm profile={teen} onSave={vi.fn()} onDone={vi.fn()} />
      </MaturityLabelsProvider>,
    );
    expect(
      within(limit())
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['All', '7+', '13+', '16+', '18+']);
  });

  it('lowering needs no password and sends the new rank', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ProfileForm profile={teen} onSave={onSave} onDone={vi.fn()} />);
    await user.selectOptions(limit(), '1');
    expect(screen.queryByLabelText(/Account password/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ maxMaturityRank: 1 }));
    expect(onSave.mock.calls[0]![0]).not.toHaveProperty('password');
  });

  it('raising asks for the account password first and sends it with the rank', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ProfileForm profile={teen} onSave={onSave} onDone={vi.fn()} />);
    await user.selectOptions(limit(), '3');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Enter your account password to raise the limit.'),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Account password/), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ maxMaturityRank: 3, password: 'secret-pass' }),
    );
  });

  it('keeps the old limit and says what happened when the password is wrong', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false, reason: 'password_required' });
    const user = userEvent.setup();
    render(<ProfileForm profile={teen} onSave={onSave} onDone={vi.fn()} />);
    await user.selectOptions(limit(), '3');
    await user.type(screen.getByLabelText(/Account password/), 'nope');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText('That password is not right. Check it and try again.'),
    ).toBeInTheDocument();
  });

  it('does not send the limit when it did not change', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ProfileForm profile={teen} onSave={onSave} onDone={vi.fn()} />);
    await user.type(screen.getByLabelText(/Name/), 'x');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave.mock.calls[0]![0]).not.toHaveProperty('maxMaturityRank');
  });

  it('fixes a kids profile at G, disabled with the reason beside it', () => {
    render(<ProfileForm profile={amina} onSave={vi.fn()} onDone={vi.fn()} />);
    expect(limit()).toBeDisabled();
    expect(limit()).toHaveValue('0');
    expect(screen.getByText('Kids profiles only show titles for all ages.')).toBeInTheDocument();
  });

  it('starts at 12 when Kids is turned off, and sends it with the password', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ProfileForm profile={amina} onSave={onSave} onDone={vi.fn()} />);
    await user.click(screen.getByRole('switch', { name: 'Kids profile' }));
    expect(limit()).toBeEnabled();
    expect(limit()).toHaveValue('2');
    await user.type(screen.getByLabelText(/Account password/), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ kids: false, maxMaturityRank: 2, password: 'secret-pass' }),
    );
  });

  it('is not on the create form', () => {
    render(<ProfileForm onSave={vi.fn()} onDone={vi.fn()} />);
    expect(screen.queryByLabelText('Allow titles rated up to')).toBeNull();
  });
});
