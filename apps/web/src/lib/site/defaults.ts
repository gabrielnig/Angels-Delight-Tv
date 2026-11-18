/**
 * Site copy that is not client content: the footer links to the four pages and the three lines on the sign in
 * panel. The platform name, tagline, support email and the page texts come from settings, not from here.
 */
export const FOOTER_LINKS = [
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'About', href: '/about' },
  { label: 'Help', href: '/help' },
] as const;

export const VALUE_LINES = [
  'Free to watch, always',
  'Short lessons you can finish in minutes',
  'Captions on every video',
] as const;

/** Common questions under the Help page text (M26-S03 AC2). They describe how the product works, not client content. */
export const HELP_ARTICLES = [
  {
    id: 'verify-email',
    question: 'I did not get my verification code',
    answer:
      'Check your spam folder, wait a minute, then choose Send a new code. You can also change the email address on the same screen.',
  },
  {
    id: 'reset-password',
    question: 'I forgot my password',
    answer:
      'On the sign in page choose Forgot password and enter your email. We send a link that works for 30 minutes.',
  },
  {
    id: 'data-use',
    question: 'How do I use less data?',
    answer:
      'Open Account, then Playback, and turn on Data saver. Video stays at a lower quality and pictures load smaller.',
  },
  {
    id: 'captions',
    question: 'How do I turn captions on?',
    answer:
      'Use the CC button in the player, or press C. In Playback settings you can choose the size and background and have captions on by default.',
  },
  {
    id: 'install',
    question: 'Can I add the site to my phone?',
    answer:
      'Yes. In your browser menu choose Add to Home screen, or Install. On iPhone use Share, then Add to Home Screen.',
  },
  {
    id: 'kids',
    question: 'How do I make a Kids profile?',
    answer: 'Choose Manage profiles, then Add profile, and turn on Kids profile.',
  },
] as const;
