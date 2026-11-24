import { msg } from '@ad/shared/messages';
import type { SelectedSponsor } from '@ad/sponsors';
import { Icon } from '@ad/ui';
import { SponsorTrackerMount } from './SponsorTrackerMount';
import { SponsoredLabel, sponsorLabelText } from './SponsoredLabel';
import './sponsor.css';

export type SponsorVariant = 'banner' | 'card' | 'message';

/**
 * One whole-card link (D-267): a single anchor, no nested control. The link goes to our own redirect so the click
 * is counted, and carries rel sponsored. The picture is decoration unless the admin gave it a description.
 */
export function SponsorSurface({
  sponsor,
  variant,
}: {
  sponsor: SelectedSponsor;
  variant: SponsorVariant;
}) {
  const image =
    variant === 'banner' ? (sponsor.wideImageUrl ?? sponsor.imageUrl) : sponsor.imageUrl;
  const accessible = msg('sponsor.link.aria', {
    label: sponsorLabelText(sponsor.label),
    name: sponsor.sponsorName,
    headline: sponsor.headline,
    cta: sponsor.ctaLabel,
  });
  return (
    <aside
      className={`sponsor sponsor--${variant}${sponsor.textOnly ? ' sponsor--text' : ''}`}
      aria-label={msg('sponsor.region')}
      data-creative={sponsor.creativeId}
      data-slot={sponsor.slot}
    >
      <a
        className="sponsor__link"
        href={sponsor.href}
        aria-label={accessible}
        {...(sponsor.newTab ? { target: '_blank' } : {})}
        rel="sponsored noopener noreferrer"
      >
        {image && !sponsor.textOnly ? (
          // eslint-disable-next-line @next/next/no-img-element -- a fixed box with its own aspect ratio; the source is our media origin
          <img
            className="sponsor__image"
            src={image}
            alt={sponsor.altText ?? ''}
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <span className="sponsor__text">
          <SponsoredLabel label={sponsor.label} name={sponsor.sponsorName} />
          <span className="sponsor__headline">{sponsor.headline}</span>
          {sponsor.body ? <span className="sponsor__body">{sponsor.body}</span> : null}
          <span className="sponsor__cta">{sponsor.ctaLabel}</span>
        </span>
        <span className="sponsor__arrow" aria-hidden="true">
          <Icon name="chevronRight" size={20} />
        </span>
        {sponsor.newTab ? <span className="ad-sr-only">{msg('sponsor.newTab')}</span> : null}
      </a>
      <SponsorTrackerMount />
    </aside>
  );
}
