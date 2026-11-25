import { HELP_ROLE_RANK, type HelpRole } from '@ad/help';
import { Badge } from '../Badge';

const ONLY: Record<HelpRole, string | null> = {
  editor: null,
  admin: 'Admin only',
  super_admin: 'Super admin only',
};

/** "Admin only" or "Super admin only" when a guide is above the person's role. Editor guides carry no label. */
export function RoleLabel({ needed, person }: { needed: HelpRole; person: HelpRole }) {
  if (HELP_ROLE_RANK[needed] <= HELP_ROLE_RANK[person]) return null;
  const text = ONLY[needed];
  return text ? (
    <Badge tone="warning" icon="lock">
      {text}
    </Badge>
  ) : null;
}
