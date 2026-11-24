import Link from 'next/link';
import type { SponsorSummary } from '@ad/sponsors';
import { Badge } from './Badge';
import { LinkButton } from './Button';
import { EmptyState } from './states';
import { SPONSOR_STATUS_LABELS, lagosDayLabel } from './sponsor-labels';

export function SponsorList({ sponsors, canManage }: { sponsors: SponsorSummary[]; canManage: boolean }) {
  if (sponsors.length === 0) {
    return (
      <EmptyState
        title="No sponsors yet."
        help="Add a sponsor, then give it a creative and tick where it should show."
        icon="sponsor"
        action={canManage ? <LinkButton href="/admin/sponsors/new" variant="primary" icon="plus">Add sponsor</LinkButton> : undefined}
      />
    );
  }
  return (
    <ul className="adm-cardlist" aria-label="Sponsors">
      {sponsors.map((s) => {
        const badge = SPONSOR_STATUS_LABELS[s.effectiveStatus];
        return (
          <li key={s.id} className="adm-card adm-listrow">
            <div className="adm-listrow__main">
              <Link href={`/admin/sponsors/${s.id}`}><strong>{s.name}</strong></Link>
              <Badge tone={badge.tone}>{badge.label}</Badge>
              <span className="adm-muted">
                {lagosDayLabel(s.startsAt)} to {lagosDayLabel(s.endsAt)}
              </span>
              <span className="adm-muted">
                {s.creativeCount} {s.creativeCount === 1 ? 'creative' : 'creatives'}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
