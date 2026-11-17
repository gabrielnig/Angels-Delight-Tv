// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Profile } from '../../lib/data';
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
    expect(radios.length).toBe(5);
    await user.click(radios[2]!);
    expect(radios[2]).toBeChecked();
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
