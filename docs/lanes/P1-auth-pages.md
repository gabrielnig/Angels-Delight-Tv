# Lane P1: sign in (S01) and sign up (S02) to the mockups

Presentation and states only. Lane B services, Turnstile, the honeypot and enumeration safe responses are unchanged.

## What exists

- `apps/web/src/components/auth/auth-ui.css`: all styling for both screens (prefix `auth-`), mobile first, breakpoints 600px (sign up card and bar) and 960px (sign in split).
- `components/auth/AuthParts.tsx`: `AuthBanner` (danger, warning, success, info, optional icon and title), `AuthField` (label, error, hint, invalid without message), `AuthPasswordField` (eye toggle, Caps Lock hint, optional strength meter and checklist), `AuthSubmit` (inline spinner, `aria-busy`), `AuthIcon`, `meterView`.
- `components/AuthLayouts.tsx`: `AuthSplit` (S01 and the signed out landing at `/`), `AuthSignUpPage` (S02). `AuthCardPage` is unchanged and still serves verify, forgot and reset.
- `SignInForm` and `SignUpForm` rebuilt on those parts. New prop `noticeTone` on `SignInForm` and `SignInScreen`.
- `lib/auth-font.ts` and `src/fonts/space-grotesk-*` (D-144). `lib/auth-notices.ts` gained `signInNoticeTone`; the `ended` copy now matches the mockup. `/sign-in?notice=ended` shows the session expired state, `?notice=reset` the success state.
- `@ad/ui` exports `zxcvbnScorer` (additive).
- Fixture only triggers (AUTH_FIXTURES): sign in password `unavailable-please`; sign up password `offline-please` (network) and `rate-limit-please` (rate limited); `FIXTURE_SIGNUP_OPEN=off` makes the fixture site invite only.

## State to mockup map

S01 (desktop and mobile): default (email focus ring), wrong email or password (danger banner, password edge red, no inline text), loading (spinner and "Signing in", button locked), network error, after password reset (success), session expired (info), sign in unavailable (warning, desktop section). Lockout, rate limit, "one more step" check and checking keep their copy and use the same banner.
S02: default, typing with a short password (Weak, two segments, fix named), strong password (all rules ticked, password shown), email not valid, Caps Lock hint, network error, rate limited (warning, clock icon), invite only (invite field between email and password, hint "Sign up is by invitation for now."), sticky submit bar below 600px.

## Tests

- `pnpm vitest run apps/web/src/components/auth` (component test per state in `SignInStates.test.tsx` and `SignUpStates.test.tsx`, `auth-ui-css.test.ts` for the mockup measurements, plus the older form tests) and `apps/web/src/lib/auth-notices.test.ts`.
- E2E (one file at a time, fixture server): `E2E_BASE_URL=http://localhost:3201 E2E_CHROMIUM_PATH=/opt/google/chrome/chrome pnpm exec playwright test e2e/auth-pages.e2e.ts` and `e2e/touch-targets.e2e.ts -g "sign in inline|sign up inline"`. `playwright.config.ts` now honours `E2E_CHROMIUM_PATH`.

## Visual verification

Mockup and built were rendered with Playwright at 1360 and 390 (app run with `VIEWER_FIXTURES=on AUTH_FIXTURES=on ADMIN_DATA=fixture`). Images in `/home/claude/compare`: `after-s01-desktop.png`, `after-s02-desktop.png` (whole screen, mockup left, built right), `after-s01-mobile.png`, `after-s02-mobile.png` and the `*-states.png` stacks (every stacked state, mockup left, built right). Full screen pixel diff at 1360: S01 0.08 percent, S02 0.06 percent of pixels. Layout boxes of every state card match the mockup to the pixel (heights equal); the stacked state cards differ only by anti aliasing, the number of password dots typed, and the 1px text baseline of the self hosted Inter against the mockup's web Inter.

## Known differences and gaps

- Data only: password dot counts, typed values, and in the desktop state cards the card padding is forced to 24px by the capture script (the mockup state cards use 24px, the live card 32px as in the mockup's main screen).
- Sign in unavailable has no mobile mockup section; it uses the same banner.
- Decisions: D-144 (font), D-145 (literal measurements), D-146 (touch target and order deviations).
