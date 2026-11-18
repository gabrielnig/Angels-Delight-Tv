import type { LegalPage, SiteContent, SiteRepository } from '../types';

const CONTENT: SiteContent = {
  platformName: 'Angels Delight TV',
  tagline: 'Learn something new, free.',
  supportEmail: 'support@angelsdelight.tv',
  valueLines: ['Free to watch, always', 'Short lessons you can finish in minutes', 'Captions on every video'],
  signUpOpen: process.env.FIXTURE_SIGNUP_OPEN !== 'off',
  footerLinks: [
    { label: 'Terms', href: '/terms' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'About', href: '/about' },
    { label: 'Help', href: '/help' },
  ],
  maintenance: { active: false },
};

const LEGAL: Record<string, LegalPage> = {
  terms: {
    slug: 'terms',
    title: 'Terms',
    updated: '1 Nov 2026',
    readingMinutes: 3,
    draft: true,
    sections: [
      { id: 'using', heading: 'Using the service', body: ['Angels Delight TV is free to watch. You need an account to keep a list and your progress.', 'Be kind and do not share your password.'] },
      { id: 'content', heading: 'Our videos', body: ['Videos are for learning and personal viewing. Please do not copy or resell them.'] },
      { id: 'contact', heading: 'Contact', body: ['Questions about these terms? Email us and we will reply within 2 working days.'] },
    ],
  },
  privacy: {
    slug: 'privacy',
    title: 'Privacy',
    updated: '1 Nov 2026',
    readingMinutes: 4,
    draft: true,
    sections: [
      { id: 'who', heading: 'Who we are', body: ['Angels Delight TV is a free learning video service. We run our own servers.'] },
      { id: 'collect', heading: 'What we collect', body: ['Your name, email address, profile names, My List and where you stopped watching. We do not sell your data.'] },
      { id: 'use', heading: 'How we use it', body: ['We use it to keep you signed in, resume your videos and make the service safer. We count views to see which lessons help most.'] },
      { id: 'choices', heading: 'Your choices', body: ['You can export or delete your data at any time from Account, then Data and privacy.'] },
      { id: 'children', heading: 'Children', body: ['Kids profiles do not record viewing history against the child.'] },
      { id: 'contact', heading: 'Contact', body: ['Email us and we will reply within 2 working days.'] },
    ],
  },
  about: {
    slug: 'about',
    title: 'About',
    updated: '1 Nov 2026',
    readingMinutes: 1,
    draft: false,
    sections: [
      { id: 'free', heading: 'Free to watch', body: ['No fees and no adverts. Create an account to keep your list and progress.'] },
      { id: 'data', heading: 'Light on data', body: ['Video adapts to your network. Turn on Data saver to use less.'] },
      { id: 'everyone', heading: 'Made for everyone', body: ['Captions on every video and a safe Kids mode for children.'] },
    ],
  },
  help: { slug: 'help', title: 'Help', updated: '1 Nov 2026', readingMinutes: 2, draft: false, sections: [] },
};

const HELP = [
  { id: 'data', question: 'How do I save data?', answer: 'Open Account, then Playback settings, and turn on Data saver. Video stays at 480p or lower.' },
  { id: 'code', question: 'I did not get my verification code', answer: 'Check your spam folder, wait a minute, then choose Send a new code. You can also change your email.' },
  { id: 'offline', question: 'Can I watch offline?', answer: 'Not yet. Videos need a connection to play, but pages you opened stay readable.' },
  { id: 'kids', question: 'How do I make a Kids profile?', answer: 'Choose Manage profiles, then Add profile, and turn on Kids profile.' },
];

export class FixtureSite implements SiteRepository {
  async content() {
    return { ...CONTENT };
  }

  async legal(slug: string) {
    return LEGAL[slug] ?? null;
  }

  async helpArticles() {
    return HELP;
  }
}
