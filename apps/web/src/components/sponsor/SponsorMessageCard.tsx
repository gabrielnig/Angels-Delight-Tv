import type { SelectedSponsor } from '@ad/sponsors';
import { SponsorSurface } from './SponsorSurface';

export function SponsorMessageCard({ sponsor }: { sponsor: SelectedSponsor }) {
  return <SponsorSurface sponsor={sponsor} variant="message" />;
}
