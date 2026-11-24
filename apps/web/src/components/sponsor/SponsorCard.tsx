import type { SelectedSponsor } from '@ad/sponsors';
import { SponsorSurface } from './SponsorSurface';

export function SponsorCard({ sponsor }: { sponsor: SelectedSponsor }) {
  return <SponsorSurface sponsor={sponsor} variant="card" />;
}
