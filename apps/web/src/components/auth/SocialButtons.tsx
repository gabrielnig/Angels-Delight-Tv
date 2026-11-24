import { msg } from '@ad/shared/messages';
import { GoogleButton } from './GoogleButton';

/**
 * The "or" divider and the Google button under the main button of Sign in and Sign up. With no configuration
 * it renders nothing, so the card closes up and no Google link exists on the page (M49-S05 AC1).
 */
export function SocialButtons({
  google,
  next,
  variant = 'continue',
}: {
  google: { href: string } | null | undefined;
  next?: string;
  variant?: 'continue' | 'signUp';
}) {
  if (!google) return null;
  const href = next ? `${google.href}?next=${encodeURIComponent(next)}` : google.href;
  return (
    <div className="google-social">
      <div className="google-divider" role="separator">
        <span>{msg('auth.google.or')}</span>
      </div>
      <GoogleButton href={href} variant={variant} />
    </div>
  );
}
