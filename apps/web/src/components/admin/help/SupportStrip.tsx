import { Icon } from '../Icon';

/** "Message ARKDEV". The contact is the setting help.support_contact: an email address or an https link (M50-S29). */
export function SupportStrip({ contact }: { contact: string }) {
  const value = contact.trim();
  const href = !value ? null : value.startsWith('https://') ? value : `mailto:${value}`;
  return (
    <aside className="hlp-support" aria-label="Contact the developer">
      <Icon name="mail" size={20} />
      <p>
        <strong>Cannot find what you need?</strong>{' '}
        {href
          ? 'Send a message and say which guide you were reading.'
          : 'The contact has not been set yet. Ask the owner to add it in Site settings.'}
      </p>
      {href ? (
        <a
          href={href}
          className="adm-btn adm-btn--secondary"
          {...(value.startsWith('https://')
            ? { target: '_blank', rel: 'noreferrer noopener' }
            : {})}
        >
          Message ARKDEV
        </a>
      ) : null}
    </aside>
  );
}
