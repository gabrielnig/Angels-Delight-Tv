import type { Profile } from '../../lib/data';
import { AcctAvatar } from './AcctAvatar';
import { AcctIcon, type AcctIconName } from './icons';
import { EditName } from './EditName';
import { SignOutButton } from '../SignOutButton';

export interface AccountOverviewData {
  displayName: string;
  email: string;
  verified: boolean;
  memberSince: string;
  watchedThisMonth: number;
  minutesLearning: number;
  myListCount: number;
  devices: number;
}

const ROWS: { href: string; label: string; hint: string; icon: AcctIconName }[] = [
  {
    href: '/account/security',
    label: 'Security',
    hint: 'Password, email and signed in devices',
    icon: 'shield',
  },
  {
    href: '/settings/playback',
    label: 'Playback settings',
    hint: 'Autoplay, video quality and captions',
    icon: 'play',
  },
  {
    href: '/account/data',
    label: 'Data and privacy',
    hint: 'Export your data or delete your account',
    icon: 'download',
  },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** 220 becomes "3 hr 40 min", 60 becomes "1 hr", 40 becomes "40 min". */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function AccountOverview({
  overview: o,
  profiles,
  maxProfiles,
  currentDevice,
}: {
  overview: AccountOverviewData;
  profiles: Pick<Profile, 'id' | 'name' | 'kids' | 'owner' | 'tone'>[];
  maxProfiles: number;
  currentDevice: string | null;
}) {
  return (
    <>
      <section className="acct-card" data-gap="5" aria-labelledby="acct-who">
        <div className="acct-row" data-between data-top data-wrap>
          <div className="acct-row">
            <AcctAvatar name={o.displayName} />
            <div className="acct-who">
              <h2 id="acct-who" className="acct-who__name">
                {o.displayName}
              </h2>
              <span className="acct-muted">{o.email}</span>
              <span className="acct-who__meta">
                {o.verified ? (
                  <span className="acct-badge" data-tone="ok">
                    <AcctIcon name="check" size={14} strokeWidth={3} />
                    Email verified
                  </span>
                ) : null}
                <span className="acct-muted acct-small">{`Member since ${o.memberSince}`}</span>
              </span>
            </div>
          </div>
          <EditName name={o.displayName} />
        </div>
        <dl className="acct-stats">
          <div>
            <dt>Watched this month</dt>
            <dd>{plural(o.watchedThisMonth, 'video', 'videos')}</dd>
          </div>
          <div>
            <dt>Time learning</dt>
            <dd>{formatMinutes(o.minutesLearning)}</dd>
          </div>
          <div>
            <dt>My List</dt>
            <dd>{plural(o.myListCount, 'title', 'titles')}</dd>
          </div>
        </dl>
      </section>

      <section className="acct-card" aria-labelledby="acct-profiles">
        <div className="acct-row" data-between>
          <h2 id="acct-profiles" className="acct-h2">
            Profiles
          </h2>
          <a href="/profiles/manage" className="acct-link">
            Manage profiles
          </a>
        </div>
        <ul className="acct-profiles">
          {profiles.map((p) => (
            <li key={p.id}>
              <AcctAvatar name={p.name} tone={p.tone} />
              <span className="acct-profiles__name">{p.name}</span>
              {p.owner ? (
                <span className="acct-muted acct-small">Owner</span>
              ) : p.kids ? (
                <span className="acct-badge" data-tone="info">
                  Kids
                </span>
              ) : (
                <span className="acct-profiles__gap" />
              )}
            </li>
          ))}
        </ul>
        <p className="acct-muted acct-small">{`Up to ${maxProfiles} profiles per account. Kids profiles show only content made for children.`}</p>
      </section>

      <nav className="acct-card acct-linklist" data-flush="list" aria-label="Account settings">
        {ROWS.map((r) => (
          <a key={r.href} href={r.href} className="acct-linkrow">
            <span className="acct-linkrow__lead">
              <AcctIcon name={r.icon} size={22} />
              <span className="acct-col">
                <span className="acct-linkrow__label">{r.label}</span>
                <span className="acct-muted acct-small">{r.hint}</span>
              </span>
            </span>
            <AcctIcon name="chevron" />
          </a>
        ))}
      </nav>

      <section
        className="acct-card acct-row"
        data-between
        data-wrap
        data-tight
        aria-label={`Signed in on ${plural(o.devices, 'device', 'devices')}`}
      >
        <div className="acct-col">
          <span className="acct-linkrow__label">{`Signed in on ${plural(o.devices, 'device', 'devices')}`}</span>
          {currentDevice ? (
            <span className="acct-muted acct-small">{`This device: ${currentDevice}`}</span>
          ) : null}
        </div>
        <SignOutButton variant="secondary" />
      </section>
    </>
  );
}
