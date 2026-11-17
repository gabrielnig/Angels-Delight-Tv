'use client';

import { useRouter } from 'next/navigation';
import {
  requestResetAction,
  resendCodeAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  verifyEmailAction,
} from '../../app/actions';
import { ForgotPasswordForm, ResetPasswordForm } from './RecoveryForms';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { VerifyEmailForm } from './VerifyEmailForm';

/** Client wrappers that connect each form to its server action and the router. */

export function SignInScreen({
  next,
  signUpOpen,
  notice,
  turnstileSiteKey,
}: {
  next?: string;
  signUpOpen: boolean;
  notice?: string;
  turnstileSiteKey?: string;
}) {
  const router = useRouter();
  return (
    <SignInForm
      next={next}
      signUpOpen={signUpOpen}
      notice={notice}
      turnstileSiteKey={turnstileSiteKey}
      onSubmit={signInAction}
      onDone={(destination) => {
        router.push(destination);
        router.refresh();
      }}
    />
  );
}

export function SignUpScreen({
  inviteOnly,
  turnstileSiteKey,
}: {
  inviteOnly: boolean;
  turnstileSiteKey?: string;
}) {
  const router = useRouter();
  return (
    <SignUpForm
      inviteOnly={inviteOnly}
      turnstileSiteKey={turnstileSiteKey}
      onSubmit={signUpAction}
      onDone={(destination) => router.push(destination)}
    />
  );
}

export function VerifyScreen({ maskedEmail }: { maskedEmail: string }) {
  const router = useRouter();
  return (
    <VerifyEmailForm
      maskedEmail={maskedEmail}
      onSubmit={verifyEmailAction}
      onResend={resendCodeAction}
      onDone={(destination) => {
        router.push(destination);
        router.refresh();
      }}
    />
  );
}

export function ForgotScreen() {
  return <ForgotPasswordForm onSubmit={requestResetAction} />;
}

export function ResetScreen({ token }: { token: string }) {
  const router = useRouter();
  return (
    <ResetPasswordForm
      token={token}
      onSubmit={resetPasswordAction}
      onDone={() => router.push('/sign-in?notice=reset')}
    />
  );
}
