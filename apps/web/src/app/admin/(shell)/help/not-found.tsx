import Link from 'next/link';
import { PageHeader } from '@/components/admin/PageHeader';
import { EmptyState } from '@/components/admin/states';
import { LinkButton } from '@/components/admin/Button';

export default function HelpNotFound() {
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Help centre', href: '/admin/help' },
          { label: 'Not found' },
        ]}
        title="We could not find that guide"
      />
      <EmptyState
        icon="book"
        title="That guide does not exist."
        help="It may have moved, or the link may have a typo. Browse all guides from the help centre."
        action={
          <LinkButton href="/admin/help" variant="primary">
            Open the help centre
          </LinkButton>
        }
      />
      <p className="adm-lead">
        <Link href="/admin">Back to the Dashboard</Link>
      </p>
    </>
  );
}
