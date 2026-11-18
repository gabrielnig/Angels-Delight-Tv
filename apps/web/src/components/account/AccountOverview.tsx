import { Icon, type IconName } from '@ad/ui';
import { formatDate, maskEmail } from '../../lib/format';
import { SignOutButton } from '../SignOutButton';

export interface AccountOverviewData {
  displayName: string;
  email: string;
  memberSince: string;
  watchedThisMonth: number;
  minutesLearning: number;
  myListCount: number;
  devices: number;
}

const ROWS: { href: string; label: string; hint: string; icon: IconName }[] = [
  { href: '/account/security', label: 'Security', hint: 'Password and sign in', icon: 'lock' },
  { href: '/settings/playback', label: 'Playback', hint: 'Speed, captions and data saver', icon: 'settings' },
  { href: '/account/data', label: 'Your data', hint: 'Download or delete your account', icon: 'shield' },
];

export function AccountOverview({ overview: o }: { overview: AccountOverviewData }) {
  const stats: [string, number][] = [
    ['Watched this month', o.watchedThisMonth],
    ['Minutes learning', o.minutesLearning],
    ['Saved in My List', o.myListCount],
    ['Signed in devices', o.devices],
  ];
  return (
    <>
      <h1 className="web-page__title">Account</h1>
      <section className="web-card web-acct-profile" aria-labelledby="acct-you">
        <span className="web-acct-profile__icon" aria-hidden="true">
          <Icon name="user" size={28} />
        </span>
        <div>
          <h2 id="acct-you" className="web-card__title">
            Your account
          </h2>
          <p className="web-acct-profile__name">{o.displayName}</p>
          <p className="web-card__sub">{maskEmail(o.email)}</p>
          <p className="web-card__sub">Member since {formatDate(o.memberSince)}</p>
        </div>
      </section>
      <section className="web-card" aria-labelledby="acct-stats">
        <h2 id="acct-stats" className="web-card__title">
          Your learning
        </h2>
        <dl className="web-stats">
          {stats.map(([label, value]) => (
            <div key={label} className="web-stats__item">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <ul className="web-card web-linkrows">
        {ROWS.map((r) => (
          <li key={r.href}>
            <a href={r.href} className="web-linkrow">
              <Icon name={r.icon} size={20} />
              <span>
                <span className="web-linkrow__label">{r.label}</span>
                <span className="web-card__sub">{r.hint}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <section className="web-card web-acct-signout" aria-label="Sign out">
        <SignOutButton />
      </section>
    </>
  );
}
