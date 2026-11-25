/**
 * Copy for lane L12: the phone header, the account sheet and the tab bar (S182 to S185). Keys follow
 * `area.kind.name`. Tab labels (`nav.home`, `nav.browse`, `nav.search`, `nav.myList`) are capped at 12 characters
 * by the translation workspace warning.
 */
export const L12_MESSAGES = {
  'nav.accountMenu': 'Account menu',
  'nav.kidsBadge': 'Kids',
  'nav.profileMenu': 'Profile menu, {name}',
  'nav.profileMenuKids': 'Profile menu, {name}, Kids profile',
  'nav.back': 'Back',
  'guest.kids.turnOn': 'Turn on Kids mode',
  'nav.sheet.close': 'Close',
  'nav.sheet.accountTitle': 'Account',
  'nav.sheet.language': 'Language',
  'nav.sheet.kidsHelp': 'Shows videos made for children. Anyone using this device can turn it off.',
} as const;
