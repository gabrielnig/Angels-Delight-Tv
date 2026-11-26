# L14 content lane C5: Money and sponsors (path M)

Guides M01 to M24 in `content/help/en/money`, episodes `scripts/kb-recorder/episodes/M01.ts` to `M24.ts` built with the step helper `scripts/kb-recorder/money-steps.ts`, pictures, `.vtt` and `.transcript.txt` in `content/help/media/M<nn>`. 24 articles, 24 videos (desktop only, recorded, mp4 not committed), about 80 screenshots. PRs 468 (M01 to M11 and the demo), 479 (M12 to M18) and the third batch (M19 to M24). Decision D-395.

## Demo stack for money
`apps/web/src/lib/data/admin/kb-demo/money.ts` gives the Sponsors, report and Donations services in memory copies of the demo dataset when `KB_DEMO=on` (fixture only). `money-settings.ts` seeds fake donate and transparency wording. `scripts/kb-stack.sh` adds a random throwaway Paystack test key. Demo reauthentication accepts any password.

## Things that cannot be shown or do not exist (stated in the guides)
- No admin screen edits `donate.*` or `sponsors.*` settings (only the sponsors master switch). The owner decides, the developer enters. Follow up: Monetization settings tab (plan S169).
- Viewer side sponsor look and the sponsor gate, bank transfer gifts, manual entry, refunds and monthly giving have no recordable screen: M16, M20, M22 are written from the code.
- Sponsor categories refused are not enforced by software: M19 gives a suggested list for the owner to confirm.
- Paystack keys are never shown: M07 and M10 describe them as hidden.
- File uploads (sponsor pictures) are pointed at, not performed (manual steps).

## Checks
Fact checker passed on M01, M02, M04 to M24. M03 still fails at step 9 (the Headline box does not appear when the checker clicks Add creative, although the recorder gets there); the guide steps are correct for a person. Open item: make the checker click wait for the creative form.
help:check, caption lint, episode coverage and the C5 article gaps are clean. `help-coverage.test.ts` passes after the gap prune.
