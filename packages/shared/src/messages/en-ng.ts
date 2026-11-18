import type { CatalogShape } from './messages';

/**
 * The English (Nigeria) message catalog, the source of truth for user facing copy that is not tied to one
 * component's markup. Keys are `area.kind.name`. Text with `{name}` takes a param, and a `{one, other}` pair is
 * chosen by the `count` param. Change copy here, never at the call site.
 */
export const EN_NG = {
  // Auth form errors and notices
  'auth.error.generic': 'Something went wrong. Please try again.',
  'auth.error.rateLimited': 'Too many attempts. Try again in {wait}.',
  'auth.error.linkExpired': 'This link has expired. Request a new one.',
  'auth.error.linkUsed': 'This link has already been used.',
  'auth.error.linkInvalid': 'This link is not valid. Request a new one.',
  'auth.error.inviteInvalid': 'That invite code is not valid. Check it and try again.',
  'auth.error.mailFailed': 'We could not send the email. Please try again in a moment.',
  'auth.error.unavailable': 'This is unavailable right now. Please try again shortly.',
  'auth.wait.minutes': { one: '{count} minute', other: '{count} minutes' },
  'auth.notice.reset': 'Your password was changed. Sign in with your new password.',
  'auth.notice.ended': 'Your session ended. Sign in again to keep watching.',

  // Account screens
  'account.overview.title': 'Account',
  'account.overview.lead': 'Your details, profiles and settings in one place.',
  'account.overview.error': 'We could not load your account',
  'account.security.title': 'Account security',
  'account.security.lead': 'Keep your account safe.',
  'account.security.error': 'We could not load your security settings',
  'account.playback.title': 'Playback settings',
  'account.playback.lead': 'Choose how video plays on every device. Changes save as you go.',
  'account.playback.error': 'We could not load your playback settings',
  'account.data.title': 'Data and privacy',
  'account.data.lead': 'Download a copy of your data or close your account.',
  'account.data.error': 'We could not load your data settings',

  'account.whoIsWatching.label': 'Always ask who is watching',
  'account.whoIsWatching.hint':
    'Show the profile picker every time someone signs in on this device. Good for a shared tablet.',
  'account.saveFailed': 'We could not save that. Try again.',

  'profiles.cache.stale': 'May be out of date',
  'profiles.cache.refreshing': 'Updating your profiles',

  // Player
  'player.resumed': 'Resumed from {time}',
  'player.captionsFailed': 'Captions could not load',
  'player.fullscreenUnavailable': 'Full screen is not available on this device',
  'player.pipUnavailable': 'Picture in picture is not available right now',
  'player.error.connectionLost.title': 'Connection lost',
  'player.error.connectionLost.body': 'We will keep your place at {time}.',
  'player.error.offline.title': 'You are offline',
  'player.error.offline.body': 'Connect to the internet to keep watching. Your place is saved.',
  'player.error.sessionExpired.title': 'Sign in again to keep watching',
  'player.error.sessionExpired.body': 'For your safety we signed you out. Your place is saved.',
  'player.error.removed.title': 'This video is no longer available',
  'player.error.removed.body': 'It may have been taken down. Try something else.',
  'player.error.cannotPlay.title': 'This video cannot play on this device',
  'player.error.cannotPlay.body': 'Try another browser or device. Reference {reference}.',
  'player.error.unsupportedBrowser.title': 'This browser cannot play this video',
  'player.error.unsupportedBrowser.body':
    'Use a recent version of Chrome, Edge, Firefox or Safari.',
} as const satisfies CatalogShape;
