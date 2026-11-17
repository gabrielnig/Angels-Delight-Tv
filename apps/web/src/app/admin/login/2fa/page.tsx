import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/admin/AuthLayout';
import { realBeginEnrolment, realTwoFactorState } from '@/server/auth/admin';
import { realAuthEnabled } from '@/server/auth/mode';
import { FIXTURE_CODE } from '@/lib/data/admin/session';
import { pendingAccountId, safeNext } from '@/lib/data/admin/session-next';
import { CodeForm } from './CodeForm';
import { EnrolForm } from './EnrolForm';
import { RecoveryForm } from './RecoveryForm';

export const metadata: Metadata = { title: 'Enter your code' };
export const dynamic = 'force-dynamic';

export default async function AdminTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; recovery?: string }>;
}) {
  if (!(await pendingAccountId())) redirect('/admin/login');
  const params = await searchParams;
  const next = safeNext(params.next);
  const recovery = realAuthEnabled() && params.recovery === '1';
  if (realAuthEnabled() && (await realTwoFactorState()) === 'none') {
    const enrolment = await realBeginEnrolment();
    if (!enrolment) redirect('/admin/login');
    return (
      <AuthLayout
        title="Set up two factor sign in"
        lead="Staff accounts need an authenticator app. Scan the code, then enter the 6 digit code it shows."
      >
        <EnrolForm qrSvg={enrolment.qrSvg} secret={enrolment.secret} next={next} />
      </AuthLayout>
    );
  }
  return (
    <AuthLayout
      title="Enter your code"
      lead="Open your authenticator app and enter the 6 digit code for this site. You can also enter a recovery code."
    >
      {recovery ? <RecoveryForm next={next} /> : <CodeForm next={next} />}
      {realAuthEnabled() ? (
        <Link
          href={`/admin/login/2fa?next=${encodeURIComponent(next)}${recovery ? '' : '&recovery=1'}`}
          className="adm-link"
        >
          {recovery ? 'Use my authenticator app' : 'Use a recovery code'}
        </Link>
      ) : null}
      {!realAuthEnabled() && process.env.NODE_ENV !== 'production' ? (
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
