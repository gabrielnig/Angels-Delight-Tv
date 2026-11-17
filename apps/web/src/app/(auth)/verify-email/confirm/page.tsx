import type { Metadata } from 'next';
import { ButtonLink, Icon } from '@ad/ui';
import { AuthCardPage } from '../../../../components/AuthLayouts';
import { getAuth, getSite } from '../../../../lib/data';

export const metadata: Metadata = { title: 'Email link' };

const COPY = {
  confirmed: {
    icon: 'success' as const,
    title: 'Email confirmed',
    text: 'Your email is confirmed. You can sign in now.',
  },
  used: {
    icon: 'info' as const,
    title: 'This link was already used',
    text: 'Your email is already confirmed. Sign in to continue.',
  },
  expired: {
    icon: 'warning' as const,
    title: 'This link has expired',
    text: 'Links work for 24 hours. We can send you a new one.',
  },
};

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [site, params] = await Promise.all([getSite().content(), searchParams]);
  const result = await getAuth().confirmEmailLink(params.token ?? '');
  const copy = COPY[result];
  return (
    <AuthCardPage site={site}>
      <div className="web-form web-form--center">
        <Icon name={copy.icon} size={64} className="web-result__icon" />
        <h1 className="web-auth__title">{copy.title}</h1>
        <p className="web-muted">{copy.text}</p>
        {result === 'expired' ? (
          <>
            <ButtonLink href="/verify-email" fullWidth>
              Send a new email
            </ButtonLink>
            <ButtonLink href="/sign-in" variant="secondary" fullWidth>
              Back to sign in
            </ButtonLink>
          </>
        ) : (
          <ButtonLink href="/sign-in" fullWidth>
            Sign in
          </ButtonLink>
        )}
      </div>
    </AuthCardPage>
  );
}
