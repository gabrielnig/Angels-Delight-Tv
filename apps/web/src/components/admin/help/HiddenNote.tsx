import Link from 'next/link';

/** The line that counts guides for a higher role, with Show them or Hide them (M50-S27). Nothing for no hidden guides. */
export function HiddenNote({
  higher,
  showAll,
  baseHref,
  roleLabel,
}: {
  higher: number;
  showAll: boolean;
  baseHref: string;
  roleLabel?: string;
}) {
  if (higher === 0) return null;
  const guides = higher === 1 ? '1 guide' : `${higher} guides`;
  return (
    <div className="hlp-hidden" role="status">
      <p>
        {roleLabel ? <strong>You are signed in as {roleLabel}. </strong> : null}
        {showAll
          ? `Showing ${guides} for a higher role. They carry a label.`
          : `${guides} for a higher role ${higher === 1 ? 'is' : 'are'} hidden.`}
      </p>
      <Link
        href={showAll ? baseHref : `${baseHref}?show=all`}
        className="adm-btn adm-btn--secondary"
      >
        {showAll ? 'Hide them' : 'Show them'}
      </Link>
    </div>
  );
}
