import { msg } from '@ad/shared/messages';
import type { DeviceKind, LoginHistoryEntry } from '../../lib/data';
import { AcctIcon, type AcctIconName } from './icons';

const ICON: Record<DeviceKind, AcctIconName> = {
  phone: 'phone',
  tablet: 'tablet',
  tv: 'tv',
  computer: 'laptop',
  other: 'laptop',
};

function outcomeText(outcome: LoginHistoryEntry['outcome']): string {
  switch (outcome) {
    case 'success':
      return msg('account.history.success');
    case 'failed':
      return msg('account.history.failed');
    case 'mfa_failed':
      return msg('account.history.mfaFailed');
    default:
      return msg('account.history.locked');
  }
}

/** Recent sign ins (S177, Could). Country and device label only, never an address. */
export function LoginHistoryCard({ entries }: { entries: LoginHistoryEntry[] }) {
  return (
    <section className="acct-card" data-gap="2" aria-labelledby="acct-history">
      <h2 id="acct-history" className="acct-h2">
        {msg('account.history.title')}
      </h2>
      <p className="acct-muted acct-small">{msg('account.history.lead')}</p>
      {entries.length === 0 ? (
        <p className="acct-muted">{msg('account.history.empty')}</p>
      ) : (
        <ul className="acct-devices">
          {entries.map((entry) => (
            <li key={entry.id} className="acct-device">
              <div className="acct-device__lead">
                <AcctIcon name={ICON[entry.device]} size={24} />
                <div className="acct-col">
                  <span className="acct-device__label">{outcomeText(entry.outcome)}</span>
                  <span className="acct-muted acct-small">{`${entry.deviceLabel}, ${entry.place}, ${entry.when}`}</span>
                </div>
              </div>
              {entry.newDevice ? (
                <span className="acct-badge" data-tone="info">
                  {msg('account.history.newDevice')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
