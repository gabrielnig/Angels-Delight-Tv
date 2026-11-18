import Link from 'next/link';

const TABS = [
  { slug: 'terms', label: 'Terms', href: '/terms' },
  { slug: 'privacy', label: 'Privacy', href: '/privacy' },
  { slug: 'about', label: 'About', href: '/about' },
  { slug: 'help', label: 'Help', href: '/help' },
] as const;

/** The four site pages as a row of pills (S31). The current page is filled. */
export function SiteTabs({ current }: { current: (typeof TABS)[number]['slug'] }) {
  return (
    <nav aria-label="Site pages" className="acct-sitetabs">
      {TABS.map((tab) => (
        <Link
          key={tab.slug}
          href={tab.href}
          className="acct-sitetab"
          aria-current={tab.slug === current ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
