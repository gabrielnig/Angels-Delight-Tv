import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/admin/AuthLayout';
import { realBeginEnrolment, realRememberDays, realTwoFactorState } from '@/server/auth/admin';
import { realAuthEnabled } from '@/server/auth/mode';
import { FIXTURE_CODE, fixtureEmailStep } from '@/lib/data/admin/session';
import { pendingAccountId, safeNext } from '@/lib/data/admin/session-next';
import { resendCodeAction, verifyCodeAction } from '../actions';
import { CodeForm } from './CodeForm';
import { EmailCodeForm } from './EmailCodeForm';
import { EnrolForm } from './EnrolForm';
import { RecoveryForm } from './RecoveryForm';

export const metadata: Metadata = { title: 'Enter your code' };
export const dynamic = 'force-dynamic';

export default async function AdminTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; recovery?: string; sent?: string }>;
}) {
  if (!(await pendingAccountId())) redirect('/admin/login');
  const params = await searchParams;
  const next = safeNext(params.next);
  const recovery = realAuthEnabled() && params.recovery === '1';
  const demoEmail = !realAuthEnabled() && fixtureEmailStep();
  const state = realAuthEnabled() ? await realTwoFactorState() : demoEmail ? 'email' : null;
  if (state === 'email') {
    const days = demoEmail ? 30 : await realRememberDays();
    return (
      <AuthLayout
        title="Check your email"
        lead="We sent a 6 digit code to the email address on your staff account. Enter it to finish signing in."
      >
        <EmailCodeForm
          next={next}
          sent={params.sent !== '0'}
          canRemember={days > 0}
          rememberDays={days}
          verify={verifyCodeAction}
          resend={resendCodeAction}
        />
        <Link href="/admin/login" className="adm-link">
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }
  if (state === 'none') {
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
