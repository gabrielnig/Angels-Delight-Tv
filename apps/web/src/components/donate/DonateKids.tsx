import { msg } from '@ad/shared/messages';
import { ButtonLink } from '@ad/ui';
import './donate.css';

/** What a kids profile sees at /donate (M48-S34): no form, no amounts, just a pointer to a grown-up. */
export function DonateKids() {
  return (
    <div className="donate-page">
      <h1 className="donate-page__title">{msg('donate.kids.title')}</h1>
      <p className="donate-page__lead">{msg('donate.kids.body')}</p>
      <div className="donate-state__actions">
        <ButtonLink href="/">{msg('donate.kids.back')}</ButtonLink>
      </div>
    </div>
  );
}
