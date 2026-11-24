'use client';

import { useT } from '../../lib/i18n/provider';
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
  AVATAR_ART,
  AVATAR_ART_IDS,
  type AvatarArtId,
} from '@ad/ui';
import type { Profile, ProfileFailure, ProfileInput } from '../../lib/data';
import { LOCALES } from '@ad/shared/messages';
import { MATURITY_DEFAULT_LABELS } from '@ad/shared';
import { useMaturityLabels } from '../../lib/maturity-context';
import { NETWORK_MESSAGE } from '../auth/shared';
import { useFocusFirstInvalid } from '../auth/useFocusFirstInvalid';

const MAX_NAME = 20;

/** A plain meaning beside each default label. A site that renames the labels keeps only its own words. */
const MATURITY_MEANING = [
  'all ages',
  'parental guidance',
  'ages 12 and up',
  'ages 15 and up',
  'adults only',
] as const;
const DEFAULT_LIMIT = 2;

const isArtId = (id: string | undefined): id is AvatarArtId =>
  id !== undefined && (AVATAR_ART_IDS as readonly string[]).includes(id);

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
  languages = ['en'],
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
  /** Enabled interface languages (content.ui_languages). */
  languages?: readonly string[];
}) {
  const msg = useT();
  const editing = Boolean(profile);
  const formRef = useRef<HTMLFormElement>(null);
  const requestFocus = useFocusFirstInvalid(formRef);
  const [name, setName] = useState(profile?.name ?? suggestedName ?? '');
  const [avatarId, setAvatarId] = useState<AvatarArtId>(
    isArtId(profile?.avatarId) ? profile.avatarId : 'sun',
  );
  const [kids, setKids] = useState(profile?.kids ?? false);
  const [language, setLanguage] = useState(profile?.language ?? 'en');
  const [autoplay, setAutoplay] = useState(profile?.autoplayNext ?? true);
  const labels = useMaturityLabels();
  const savedRank = profile?.kids ? 0 : (profile?.maxMaturityRank ?? DEFAULT_LIMIT);
  const [rank, setRank] = useState(String(savedRank));
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
    avatarId !== (isArtId(profile?.avatarId) ? profile.avatarId : 'sun') ||
    kids !== (profile?.kids ?? false) ||
    (editing &&
      (language !== (profile?.language ?? 'en') ||
        autoplay !== (profile?.autoplayNext ?? true) ||
        (!kids && Number(rank) !== savedRank) ||
        pin !== '' ||
        removePin));

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const pinChange = !kids && editing && (pin !== '' || removePin);
  const raisesLimit = editing && !kids && Number(rank) > savedRank;
  const needsPassword = (Boolean(profile?.kids) && !kids) || pinChange || raisesLimit;
  const pinProblem =
    !kids && pin !== '' && !/^\d{4}$/.test(pin) ? msg('profiles.useExactlyFourDigits') : undefined;
  const nameProblem = !name.trim() ? msg('profiles.typeANameFor') : undefined;
  const passwordProblem =
    needsPassword && !password
      ? pinChange
        ? msg('profiles.enterYourAccountPassword3')
        : profile?.kids && !kids
          ? msg('profiles.enterYourAccountPassword4')
          : msg('profiles.enterYourAccountPassword5')
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
        avatarId,
        ...(editing ? { language, autoplayNext: autoplay } : {}),
      };
      if (editing && !kids && (Number(rank) !== savedRank || Boolean(profile?.kids)))
        input.maxMaturityRank = Number(rank);
      if (needsPassword) input.password = password;
      if (!kids && editing && pin !== '') input.pin = pin;
      else if (!kids && editing && removePin) input.pin = null;
      const result = await onSave(input);
      if (result.ok) {
        onDone();
        return;
      }
      if (result.reason === 'duplicate') {
        setNameServerError(msg('profiles.youAlreadyHaveA', { value1: name.trim() }));
        requestFocus();
      } else if (result.reason === 'limit') setBanner(msg('profiles.youHaveReached5'));
      else if (result.reason === 'last_adult') setBanner(msg('profiles.thisIsTheLast'));
      else if (result.reason === 'password_required') {
        setPasswordServerError(msg('profiles.thatPasswordIsNot'));
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
      } else setDeleteError(msg('profiles.weCouldNotDelete'));
    } catch {
      setDeleteError(msg('profiles.weCouldNotDelete'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form ref={formRef} className="web-form web-profileform" onSubmit={submit} noValidate>
      <div>
        <h1 className="web-auth__title">
          {editing ? msg('profiles.editProfile') : msg('profiles.addAProfile')}
        </h1>
        <p className="web-muted">
          {editing ? msg('profiles.changesApplyToThis') : msg('profiles.pickANameAnd')}
        </p>
      </div>
      {limitReached && !editing ? (
        <Banner tone="warning" title={msg('profiles.youHaveReached52')}>
          {msg('profiles.deleteAProfileBefore')}
        </Banner>
      ) : null}
      {banner ? <Banner tone="danger">{banner}</Banner> : null}

      <Input
        label="Name"
        required
        name="name"
        maxLength={MAX_NAME}
        autoComplete="off"
        placeholder={msg('profiles.typeAName')}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setNameServerError(undefined);
        }}
        hint={
          <>
            {msg('profiles.upTo20Characters')}{' '}
            <span className="web-counter">{`${name.length}/${MAX_NAME}`}</span>
          </>
        }
        error={(submitted ? nameProblem : undefined) ?? nameServerError}
      />

      <div role="radiogroup" aria-label={msg('profiles.picture')} className="web-avatars">
        <span className="ad-field__label" aria-hidden="true">
          {msg('profiles.picture')}
        </span>
        <div className="web-avatars__row">
          {AVATAR_ART_IDS.map((id) => (
            <label key={id} className="web-avatars__option">
              <input
                type="radio"
                name="avatar"
                className="web-avatars__input"
                value={id}
                checked={avatarId === id}
                onChange={() => setAvatarId(id)}
              />
              <span className="web-avatars__face">
                <Avatar name={name || 'A'} avatarId={id} size={64} />
              </span>
              <span className="ad-sr-only">{AVATAR_ART[id].label}</span>
            </label>
          ))}
        </div>
      </div>

      <Switch
        label="Kids profile"
        checked={kids}
        onCheckedChange={(value) => {
          setKids(value);
          // Leaving Kids mode starts at the default limit and can be changed straight away.
          if (!value && profile?.kids)
            setRank((current) => (current === '0' ? String(DEFAULT_LIMIT) : current));
        }}
        hint="Shows only videos picked as suitable for children. Search and categories are limited, and leaving Kids mode needs your account password."
      />

      {editing ? (
        <Select
          label="Allow titles rated up to"
          value={kids ? '0' : rank}
          disabled={kids}
          onChange={(event) => {
            setRank(event.target.value);
            setPasswordServerError(undefined);
          }}
          hint={kids ? msg('profiles.kidsProfilesOnlyShow') : msg('profiles.titlesAboveThisRating')}
        >
          {labels.map((label, index) => (
            <option key={index} value={String(index)}>
              {label === MATURITY_DEFAULT_LABELS[index]
                ? `${label}, ${MATURITY_MEANING[index]}`
                : label}
            </option>
          ))}
        </Select>
      ) : null}

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
                ? msg('profiles.thisProfileHasA')
                : msg('profiles.fourDigitsAnyoneOpening')
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
            {LOCALES.filter((l) => languages.includes(l.code) || l.code === language).map(
              (item) => (
                <option key={item.code} value={item.code} lang={item.htmlLang}>
                  {item.endonym}
                </option>
              ),
            )}
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
          {editing ? msg('profiles.saveChanges') : msg('profiles.createProfile')}
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
          {msg('profiles.cancel')}
        </ButtonLink>
      </div>

      <ConfirmDialog
        open={discardOpen}
        title={msg('profiles.discardYourChanges')}
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
            {msg('profiles.deleteProfile')}
          </Button>
        </div>
      ) : null}

      {profile && lastAdult ? (
        <Modal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={msg('profiles.youCannotDelete', { name: profile.name })}
          footer={<Button onClick={() => setConfirmOpen(false)}>{msg('profiles.ok')}</Button>}
        >
          <p className="web-muted">
            {`${profile.name} is the last adult profile on this account. Make another profile an adult profile first, then try again.`}
          </p>
        </Modal>
      ) : profile ? (
        <ConfirmDialog
          open={confirmOpen}
          title={msg('profiles.delete', { name: profile.name })}
          description={msg('profiles.thisPermanentlyDeletesS', { name: profile.name })}
          confirmLabel={deleteError ? msg('profiles.tryAgain') : msg('profiles.deleteProfile')}
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
