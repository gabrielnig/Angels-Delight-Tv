'use client';

import { clearServiceWorkerCaches } from '../../lib/pwa/purge';
import { useRouter } from 'next/navigation';
import {
  requestResetAction,
  resendCodeAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  verifyEmailAction,
  verifyRecoveryAction,
  verifyTwoStepAction,
} from '../../app/actions';
import { confirmGoogleLinkAction, finishGoogleSignUpAction } from '../../app/actions-google';
import { FinishGoogleSignUp } from './FinishGoogleSignUp';
import { LinkGoogleForm } from './LinkGoogleForm';
import { ForgotPasswordForm, ResetPasswordForm } from './RecoveryForms';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { TwoStepForm } from './TwoStepForm';
import { VerifyEmailForm } from './VerifyEmailForm';

/** Client wrappers that connect each form to its server action and the router. */

export function SignInScreen({
  next,
  signUpOpen,
  notice,
  noticeTone,
  turnstileSiteKey,
  google,
}: {
  next?: string;
  signUpOpen: boolean;
  notice?: string;
  noticeTone?: 'success' | 'info';
  turnstileSiteKey?: string;
  google?: { href: string } | null;
}) {
  const router = useRouter();
  return (
    <SignInForm
      next={next}
      signUpOpen={signUpOpen}
      notice={notice}
      noticeTone={noticeTone}
      turnstileSiteKey={turnstileSiteKey}
      google={google}
      onSubmit={signInAction}
      onDone={(destination) => {
        // Pages cached for a guest must not outlive the sign in (M40).
        clearServiceWorkerCaches(navigator);
        router.push(destination);
        router.refresh();
      }}
    />
  );
}

export function SignUpScreen({
  inviteOnly,
  turnstileSiteKey,
  google,
}: {
  inviteOnly: boolean;
  turnstileSiteKey?: string;
  google?: { href: string } | null;
}) {
  const router = useRouter();
  return (
    <SignUpForm
      inviteOnly={inviteOnly}
      turnstileSiteKey={turnstileSiteKey}
      google={google}
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

export function TwoStepScreen({ next, supportEmail }: { next?: string; supportEmail?: string }) {
  const router = useRouter();
  return (
    <TwoStepForm
      supportEmail={supportEmail}
      onVerify={(code) => verifyTwoStepAction({ code, next })}
      onRecover={(code) => verifyRecoveryAction({ code, next })}
      onDone={(destination) => {
        clearServiceWorkerCaches(navigator);
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

export function LinkGoogleScreen({ hint }: { hint: string }) {
  const router = useRouter();
  return (
    <LinkGoogleForm
      hint={hint}
      onConfirm={confirmGoogleLinkAction}
      onDone={(destination) => {
        clearServiceWorkerCaches(navigator);
        router.push(destination);
        router.refresh();
      }}
    />
  );
}

export function FinishGoogleScreen({ hint }: { hint: string }) {
  const router = useRouter();
  return (
    <FinishGoogleSignUp
      hint={hint}
      onFinish={finishGoogleSignUpAction}
      onDone={(destination) => {
        clearServiceWorkerCaches(navigator);
        router.push(destination);
        router.refresh();
      }}
    />
  );
}
