import type { BulkOutcome, BulkUndo } from '@/lib/data/admin/bulk';
import type { UserRecord } from '@/lib/data/admin/types';
import type { UserBulkAction } from '@/lib/data/admin/user-bulk';
import { Button, LinkButton } from './Button';
import { EmptyState } from './states';
import { UsersTableClient } from './UsersTableClient';

/** Server rendered. The filter is a plain GET form, so it works without scripts. */
export function UsersTable({
  users,
  q,
  status,
  canBulk,
  selfId,
  bulk,
  undo,
}: {
  users: UserRecord[];
  q: string;
  status: string;
  canBulk: boolean;
  selfId: string;
  bulk: (ids: string[], action: UserBulkAction, bulkId: string) => Promise<BulkOutcome>;
  undo: (undo: BulkUndo) => Promise<{ succeeded: string[]; failed: unknown[] }>;
}) {
  return (
    <div className="adm-stack">
      <form method="get" className="adm-toolbar" role="search" aria-label="Find users">
        <label className="adm-field" style={{ flex: '1 1 14rem' }}>
          <span className="adm-field__label">Search by email or profile name</span>
          <input className="adm-input" type="search" name="q" defaultValue={q} autoComplete="off" />
        </label>
        <label className="adm-field">
          <span className="adm-field__label">Status</span>
          <select className="adm-input adm-select" name="status" defaultValue={status}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <Button type="submit" variant="primary" icon="search">
          Search
        </Button>
        {q || status ? <LinkButton href="/admin/users">Clear</LinkButton> : null}
      </form>
      {users.length === 0 ? (
        <EmptyState
          title="No users match."
          help="Check the spelling or clear the filters."
          icon="users"
        />
      ) : (
        <UsersTableClient users={users} canBulk={canBulk} selfId={selfId} bulk={bulk} undo={undo} />
      )}
    </div>
  );
}
