import { msg } from '@ad/shared/messages';
import { ButtonLink, EmptyState } from '@ad/ui';

const NEXT = encodeURIComponent('/my-list');

/** S85. My List needs an account, so a visitor gets the reason and the way in. In Kids mode only a note for a grown-up. */
export function MyListExplainer({ signUpOpen, kids }: { signUpOpen: boolean; kids: boolean }) {
  if (kids) {
    return (
      <EmptyState
        icon="list"
        title={msg('guest.myList.title')}
        description={msg('guest.myList.kidsBody')}
      />
    );
  }
  return (
    <EmptyState
      icon="list"
      title={msg('guest.myList.title')}
      description={msg('guest.myList.body')}
      action={{ label: msg('guest.save.signIn'), href: `/sign-in?next=${NEXT}` }}
    >
      <div className="web-title-actions">
        {signUpOpen ? (
          <ButtonLink href={`/sign-up?next=${NEXT}`} variant="secondary">
            {msg('guest.save.createAccount')}
          </ButtonLink>
        ) : null}
        <ButtonLink href="/browse" variant="ghost">
          {msg('guest.kids.browse')}
        </ButtonLink>
      </div>
    </EmptyState>
  );
}
