import Link from 'next/link';
import { formatDate } from '@/lib/admin/format';
import type { UserRecord } from '@/lib/data/admin/types';
import { Badge } from './Badge';
import { Button, LinkButton } from './Button';
import { EmptyState } from './states';

/** Server rendered. The filter is a plain GET form, so it works without scripts. */
export function UsersTable({
  users,
  q,
  status,
}: {
  users: UserRecord[];
  q: string;
  status: string;
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
        <div className="adm-card adm-table-card">
          <table className="adm-table adm-table--always">
            <caption className="adm-sr">Viewer accounts</caption>
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col">Last active</th>
                <th scope="col" className="adm-num">
                  Profiles
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <th scope="row">
                    <Link className="adm-link" href={`/admin/users/${u.id}`}>
                      {u.email}
                    </Link>
                  </th>
                  <td>
                    <Badge
                      tone={u.status === 'active' ? 'success' : 'warning'}
                      icon={u.status === 'active' ? 'check' : 'lock'}
                    >
                      {u.status === 'active' ? 'Active' : 'Suspended'}
                    </Badge>
                  </td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>{u.lastActiveAt ? formatDate(u.lastActiveAt) : 'Never'}</td>
                  <td className="adm-num">{u.profiles.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
