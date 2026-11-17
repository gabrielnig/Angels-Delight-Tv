import type { Metadata } from 'next';
import { ButtonLink } from '@ad/ui';
import { AuthCardPage } from '../../../components/AuthLayouts';
import { ResetScreen } from '../../../components/auth/AuthScreens';
import { getSite } from '../../../lib/data';

export const metadata: Metadata = { title: 'Reset password' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [site, params] = await Promise.all([getSite().content(), searchParams]);
  return (
    <AuthCardPage site={site}>
      {params.token ? (
        <ResetScreen token={params.token} />
      ) : (
        <div className="web-form">
          <h1 className="web-auth__title">This link is not valid</h1>
          <p className="web-muted">Open the link from your email again, or ask for a new one.</p>
          <ButtonLink href="/forgot-password" fullWidth>
            Send a new link
          </ButtonLink>
        </div>
      )}
    </AuthCardPage>
  );
}
