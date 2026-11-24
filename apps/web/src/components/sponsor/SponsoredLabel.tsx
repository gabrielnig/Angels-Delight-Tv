import { msg } from '@ad/shared/messages';
import type { SponsorLabelKey } from '@ad/sponsors';

const TEXT = {
  sponsored: () => msg('sponsor.label.sponsored'),
  sponsor_message: () => msg('sponsor.label.sponsor_message'),
  in_partnership_with: () => msg('sponsor.label.in_partnership_with'),
} as const;

export const sponsorLabelText = (label: SponsorLabelKey): string =>
  (TEXT[label] ?? TEXT.sponsored)();

/** The chip that marks a card as paid for. It sits on its own surface so a client theme cannot weaken it. */
export function SponsoredLabel({ label, name }: { label: SponsorLabelKey; name: string }) {
  return (
    <span className="sponsor__label">
      <span>{sponsorLabelText(label)}</span>
      <span className="sponsor__name">{name}</span>
    </span>
  );
}
