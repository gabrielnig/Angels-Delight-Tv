'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Avatar,
  Banner,
  Button,
  ButtonLink,
  ConfirmDialog,
  Input,
  Modal,
  PasswordField,
  Select,
  Switch,
  type AvatarTone,
} from '@ad/ui';
import type { Profile, ProfileFailure, ProfileInput } from '../../lib/data';
import { NETWORK_MESSAGE } from '../auth/shared';
import { useFocusFirstInvalid } from '../auth/useFocusFirstInvalid';

const TONES: Array<{ tone: AvatarTone; label: string }> = [
  { tone: 'sky', label: 'Sky blue' },
  { tone: 'mint', label: 'Mint green' },
  { tone: 'lemon', label: 'Lemon' },
  { tone: 'peach', label: 'Peach' },
  { tone: 'lavender', label: 'Lavender' },
];

const LANGUAGES = [{ value: 'en', label: 'English' }];
const MAX_NAME = 20;

export type SaveInput = ProfileInput & { password?: string };
type SaveResult = { ok: true } | { ok: false; reason: ProfileFailure };

export function ProfileForm({
  profile,
  limitReached = false,
  lastAdult = false,
  onSave,
  onDelete,
  onDone,
  cancelHref = '/profiles/manage',
  suggestedName,
}: {
  profile?: Profile;
  /** Pre-fills the name of a first profile, from the email prefix. */
  suggestedName?: string;
  limitReached?: boolean;
  /** True when this is the only adult profile, so it cannot be deleted. */
  lastAdult?: boolean;
  onSave: (input: SaveInput) => Promise<SaveResult>;
  onDelete?: () => Promise<{ ok: true } | { ok: false; reason: ProfileFailure }>;
  onDone: () => void;
  cancelHref?: string;
}) {
  const editing = Boolean(profile);
  const formRef = useRef<HTMLFormElement>(null);
  const requestFocus = useFocusFirstInvalid(formRef);
  const [name, setName] = useState(profile?.name ?? suggestedName ?? '');
  const [tone, setTone] = useState<AvatarTone>((profile?.tone as AvatarTone | undefined) ?? 'sky');
  const [kids, setKids] = useState(profile?.kids ?? false);
  const [language, setLanguage] = useState(profile?.language ?? 'en');
  const [autoplay, setAutoplay] = useState(profile?.autoplayNext ?? true);
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [removePin, setRemovePin] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [nameServerError, setNameServerError] = useState<string | undefined>();
  const [passwordServerError, setPasswordServerError] = useState<string | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  const [discardOpen, setDiscardOpen] = useState(false);
  const dirty =
    name !== (profile?.name ?? suggestedName ?? '') ||
    tone !== ((profile?.tone as AvatarTone | undefined) ?? 'sky') ||
    kids !== (profile?.kids ?? false) ||
    (editing &&
      (language !== (profile?.language ?? 'en') ||
        autoplay !== (profile?.autoplayNext ?? true) ||
        pin !== '' ||
        removePin));

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const pinChange = !kids && editing && (pin !== '' || removePin);
  const needsPassword = (Boolean(profile?.kids) && !kids) || pinChange;
  const pinProblem =
    !kids && pin !== '' && !/^\d{4}$/.test(pin) ? 'Use exactly four digits.' : undefined;
  const nameProblem = !name.trim() ? 'Type a name for this profile.' : undefined;
  const passwordProblem =
    needsPassword && !password
      ? pinChange
        ? 'Enter your account password to change the PIN.'
        : 'Enter your account password to make this an adult profile.'
      : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setBanner(null);
    setNameServerError(undefined);
    setPasswordServerError(undefined);
    if (nameProblem || passwordProblem || pinProblem) {
      requestFocus();
      return;
    }
    setBusy(true);
    try {
      const input: SaveInput = {
        name: name.trim(),
        kids,
        tone,
        ...(editing ? { language, autoplayNext: autoplay } : {}),
      };
      if (needsPassword) input.password = password;
      if (!kids && editing && pin !== '') input.pin = pin;
      else if (!kids && editing && removePin) input.pin = null;
      const result = await onSave(input);
      if (result.ok) {
        onDone();
        return;
      }
      if (result.reason === 'duplicate') {
        setNameServerError(
          `You already have a profile called ${name.trim()}. Choose a different name.`,
        );
        requestFocus();
      } else if (result.reason === 'limit')
        setBanner('You have reached 5 profiles. Delete a profile before adding another.');
      else if (result.reason === 'last_adult')
        setBanner('This is the last adult profile. Make another profile an adult profile first.');
      else if (result.reason === 'password_required') {
        setPasswordServerError('That password is not right. Check it and try again.');
        requestFocus();
      } else setBanner(NETWORK_MESSAGE);
    } catch {
      setBanner(NETWORK_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!onDelete) return;
    setDeleting(true);
    setDeleteError(undefined);
    try {
      const result = await onDelete();
      if (result.ok) {
        setConfirmOpen(false);
        onDone();
      } else setDeleteError('We could not delete this profile. Try again.');
    } catch {
      setDeleteError('We could not delete this profile. Try again.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form ref={formRef} className="web-form web-profileform" onSubmit={submit} noValidate>
      <div>
        <h1 className="web-auth__title">{editing ? 'Edit profile' : 'Add a profile'}</h1>
        <p className="web-muted">
          {editing ? 'Changes apply to this profile only.' : 'Pick a name and a picture.'}
        </p>
      </div>
      {limitReached && !editing ? (
        <Banner tone="warning" title="You have reached 5 profiles.">
          Delete a profile before adding another.
        </Banner>
      ) : null}
      {banner ? <Banner tone="danger">{banner}</Banner> : null}

      <Input
        label="Name"
        required
        name="name"
        maxLength={MAX_NAME}
        autoComplete="off"
        placeholder="Type a name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setNameServerError(undefined);
        }}
        hint={
          <>
            Up to 20 characters. <span className="web-counter">{`${name.length}/${MAX_NAME}`}</span>
          </>
        }
        error={(submitted ? nameProblem : undefined) ?? nameServerError}
      />

      <div role="radiogroup" aria-label="Picture" className="web-avatars">
        <span className="ad-field__label" aria-hidden="true">
          Picture
        </span>
        <div className="web-avatars__row">
          {TONES.map((option) => (
            <label key={option.tone} className="web-avatars__option">
              <input
                type="radio"
                name="tone"
                className="web-avatars__input"
                value={option.tone}
                checked={tone === option.tone}
                onChange={() => setTone(option.tone)}
              />
              <span className="web-avatars__face">
                <Avatar name={name || 'A'} tone={option.tone} size={64} />
              </span>
              <span className="ad-sr-only">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <Switch
        label="Kids profile"
        checked={kids}
        onCheckedChange={setKids}
        hint="Shows only videos picked as suitable for children. Search and categories are limited, and leaving Kids mode needs your account password."
      />

      {editing && !kids ? (
        <>
          <Input
            label="PIN"
            optional
            name="pin"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            hint={
              profile?.hasPin
                ? 'This profile has a PIN. Type four digits to change it.'
                : 'Four digits. Anyone opening this profile will need it.'
            }
            error={submitted ? pinProblem : undefined}
          />
          {profile?.hasPin ? (
            <Switch
              label="Remove the PIN"
              checked={removePin}
              onCheckedChange={setRemovePin}
              hint="Anyone can open this profile without a PIN."
            />
          ) : null}
        </>
      ) : null}

      {needsPassword ? (
        <PasswordField
          label="Account password (required)"
          mode="current"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setPasswordServerError(undefined);
          }}
          error={(submitted ? passwordProblem : undefined) ?? passwordServerError}
        />
      ) : null}

      {editing ? (
        <>
          <Select
            label="Language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            hint="Captions and menus use this language for this profile."
          >
            {LANGUAGES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Switch
            label="Autoplay next video"
            checked={autoplay}
            onCheckedChange={setAutoplay}
            hint="Start the next video in a series when one ends."
          />
        </>
      ) : null}

      <div className="web-form__actions">
        <Button type="submit" size="lg" loading={busy} disabled={limitReached && !editing}>
          {editing ? 'Save changes' : 'Create profile'}
        </Button>
        <ButtonLink
          href={cancelHref}
          variant="secondary"
          size="lg"
          onClick={(event) => {
            if (!dirty) return;
            event.preventDefault();
            setDiscardOpen(true);
          }}
        >
          Cancel
        </ButtonLink>
      </div>

      <ConfirmDialog
        open={discardOpen}
        title="Discard your changes?"
        description="You have changes that are not saved."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setDiscardOpen(false);
          onDone();
        }}
        onClose={() => setDiscardOpen(false)}
      />

      {editing && onDelete ? (
        <div className="web-danger">
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Delete profile
          </Button>
        </div>
      ) : null}

      {profile && lastAdult ? (
        <Modal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={`You cannot delete ${profile.name}`}
          footer={<Button onClick={() => setConfirmOpen(false)}>OK</Button>}
        >
          <p className="web-muted">
            {`${profile.name} is the last adult profile on this account. Make another profile an adult profile first, then try again.`}
          </p>
        </Modal>
      ) : profile ? (
        <ConfirmDialog
          open={confirmOpen}
          title={`Delete ${profile.name}?`}
          description={`This permanently deletes ${profile.name}'s watch history, My List and settings. This cannot be undone.`}
          confirmLabel={deleteError ? 'Try again' : 'Delete profile'}
          cancelLabel="Keep it"
          danger
          loading={deleting}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onClose={() => setConfirmOpen(false)}
        />
      ) : null}
    </form>
  );
}
