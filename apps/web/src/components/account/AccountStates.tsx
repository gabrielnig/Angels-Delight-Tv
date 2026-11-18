'use client';

import type { ReactNode } from 'react';
import { Button, ButtonLink } from '@ad/ui';
import { AcctIcon } from './icons';

function Skel({ s, circle }: { s: string; circle?: boolean }) {
  return <div className="acct-skel" data-s={s} data-shape={circle ? 'circle' : undefined} />;
}

/** S27 state 2. Shown by the route after 300 ms, static under reduced motion. */
export function AccountOverviewSkeleton({ label = 'Loading your account' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="acct-skeleton">
      <section className="acct-card" data-gap="5">
        <div className="acct-row">
          <Skel s="avatar" circle />
          <div className="acct-skel-stack">
            <Skel s="name" />
            <Skel s="email" />
            <Skel s="meta" />
          </div>
        </div>
      </section>
      <section className="acct-card">
        <Skel s="title" />
        <div className="acct-row">
          <Skel s="avatar" circle />
          <Skel s="avatar" circle />
          <Skel s="avatar" circle />
          <Skel s="avatar" circle />
        </div>
      </section>
      <section className="acct-card" data-gap="3">
        <Skel s="bar" />
        <Skel s="bar" />
        <Skel s="bar" />
      </section>
    </div>
  );
}

/** S29 state 4: the settings card with a title, a hint and a control on every row. */
export function SettingsSkeleton({ label = 'Loading your playback settings' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="acct-skeleton">
      <section className="acct-card acct-settings">
        {[0, 1, 2, 3, 4].map((n) => (
          <div key={n} className="acct-setting">
            <div className="acct-skel-line">
              <Skel s="text" />
              <Skel s="sub" />
            </div>
            <Skel s="switch" />
          </div>
        ))}
      </section>
    </div>
  );
}

/** S27 state 3. The reference is the server log id, so support can find the failure. */
export function AccountLoadError({
  title,
  supportEmail,
  reference,
  onRetry,
}: {
  title: string;
  supportEmail: string;
  reference?: string;
  onRetry: () => void;
}) {
  return (
    <>
      <div className="acct-card" data-tone="error" data-gap="3" role="alert">
        <div className="acct-row" data-tight>
          <span className="acct-card__icon-danger">
            <AcctIcon name="warning" size={22} />
          </span>
          <h2 className="acct-h3">{title}</h2>
        </div>
        <p className="acct-muted">Something went wrong on our side. Try again in a moment.</p>
        <Button onClick={onRetry}>Retry</Button>
      </div>
      <p className="acct-muted acct-small">
        {reference
          ? `If this keeps happening, email ${supportEmail} and quote reference ${reference}.`
          : `If this keeps happening, email ${supportEmail}.`}
      </p>
    </>
  );
}

/** S27 state 4. A Kids profile cannot open account settings, so it is sent to switch profile. */
export function AdultsOnly({ profileName }: { profileName: string }): ReactNode {
  return (
    <div className="acct-adults">
      <section className="acct-card" data-gap="3">
        <div className="acct-row" data-tight>
          <span className="acct-card__icon">
            <AcctIcon name="lock" size={24} />
          </span>
          <h2 className="acct-h2" data-size="lg">
            Account is for adults
          </h2>
        </div>
        <p className="acct-muted">{`You are in ${profileName}'s Kids profile. Switch to an adult profile to open account settings.`}</p>
        <div className="acct-row" data-tight data-wrap>
          <ButtonLink href="/profiles?switch=1">Switch profile</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Back to Home
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
