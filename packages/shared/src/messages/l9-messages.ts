/**
 * Copy for lane L9 (module M48): sponsors and donations. Kept in its own file and spread into `EN_NG`, so the lane
 * adds keys without touching the main catalog. Keys follow `area.kind.name`.
 */
export const L9_MESSAGES = {
  // Sponsor labels (M48-S03). The label can change wording but never goes away.
  'sponsor.label.sponsored': 'Sponsored',
  'sponsor.label.sponsor_message': 'Sponsor message',
  'sponsor.label.in_partnership_with': 'In partnership with',
  'sponsor.link.aria': '{label} {name}: {headline}. {cta}',
  'sponsor.newTab': 'Opens in a new tab',
  'sponsor.skip': 'Skip',
  'sponsor.continueIn': 'Your video starts in {count} seconds',
  'sponsor.continueNow': 'Continue to the video',
  'sponsor.region': 'Sponsor message',
} as const;
