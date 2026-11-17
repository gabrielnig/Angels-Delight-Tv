import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/admin/AuthLayout';
import { FIXTURE_CODE } from '@/lib/data/admin/session';
import { pendingAccountId, safeNext } from '@/lib/data/admin/session-next';
import { CodeForm } from './CodeForm';

export const metadata: Metadata = { title: 'Enter your code' };
export const dynamic = 'force-dynamic';

export default async function AdminTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (!(await pendingAccountId())) redirect('/admin/login');
  const next = safeNext((await searchParams).next);
  return (
    <AuthLayout
      title="Enter your code"
      lead="Open your authenticator app and enter the 6 digit code for this site."
    >
      <CodeForm next={next} />
      {process.env.NODE_ENV !== 'production' ? (
        <p className="adm-muted" style={{ margin: 0 }}>
          Fixture build: the code is {FIXTURE_CODE}.
        </p>
      ) : null}
      <Link href="/admin/login" className="adm-link">
        Back to sign in
      </Link>
    </AuthLayout>
  );
}
