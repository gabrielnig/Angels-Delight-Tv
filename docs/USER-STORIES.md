# User Stories

Stories for every module in `docs/MODULES.md`. Business rules (thresholds, limits, lockouts) come from section 8 of `docs/PRD.md`. Screens are in `docs/SCREEN-ARCHITECTURE.md`, where each screen lists the stories it realises.

## How to read this document

- **Id.** `Mxx-Syy`: module and story number.
- **Priority.** Must (needed for launch), Should (wanted for launch if time allows), Could (later or optional).
- **AC.** Acceptance criteria in Given, When, Then form. Each AC line is a testable statement and maps to a failing test written first.
- **Edge.** Unusual but valid situations.
- **Error.** What the viewer or admin sees when something fails. Error copy never blames the user and never reveals private facts.
- **Empty.** What shows when there is nothing yet.
- Personas: Viewer (Tobi), Diaspora viewer (Chidinma), Kid (Kemi), Parent, Admin (Sister Vanessa), Super admin (ARKDEV).
- Numbers shown (5 attempts, 15 minutes, 95 percent and so on) are configurable defaults from M29.

---

## M01 Auth (viewer)

### M01-S01 Sign up with email and password (Must)
As a new viewer, I want to create an account with my email and a password, so that I can save my profiles and progress.
- AC1: Given I am on `/sign-up`, When I enter a valid email and a password of at least 10 characters and submit, Then an account is created with status `unverified` and I am taken to `/verify-email`.
- AC2: Given I submit an email that already has an account, When the request completes, Then I see the same "Check your email" screen as for a new account, and the existing owner receives a "someone tried to sign up" email (no account existence leak).
- AC3: Given I leave a field, When I blur it, Then validation runs on blur first and then on change to clear errors as I correct them, with `aria-invalid` and `aria-describedby`.
- AC4: Given I am on a 360 px wide phone, When the on-screen keyboard opens, Then the submit button stays reachable and the email field uses `inputmode="email"` and `autocomplete="email"`.
- Edge: email with capital letters or trailing spaces is normalised (trimmed, lowercased domain, whole address lowercased for matching). Plus addressing (`a+b@x.com`) is allowed. Disposable email domains are allowed unless a blocklist flag is on (Could).
- Error: network failure shows "Could not reach the server. Your details are still here. Try again." and keeps the form values (never the password in storage). Server validation failure maps to the matching field.
- Empty: not applicable.

### M01-S02 Live password guidance (Must)
As a new viewer, I want live feedback while I type my password, so that I choose one that is strong and I can fix problems early.
- AC1: Given I type in the password field, When the value changes, Then a checklist shows "At least 10 characters", "Not a very common password", "Not the same as your email", updating live.
- AC2: Given the zxcvbn score is below 3, When I look at the meter, Then it shows a multi-segment indicator with a plain word (Weak, Fair, Good, Strong) and a hint, and submit is allowed only when the checklist passes (the meter is advice, the checklist is the gate).
- AC3: Given I paste a password, When I paste, Then paste works (never blocked) and the checklist updates.
- AC4: Given I tap the visibility toggle, When toggled, Then the field switches between password and text, with an accessible label "Show password" or "Hide password", and `autocomplete="new-password"` is set.
- Edge: passwords up to 128 characters accepted, spaces and unicode allowed. Password manager fill works.
- Error: if the common password list cannot load, the length rule still applies and sign up continues (the list is bundled server side, so this is a server check only).
- Empty: with an empty field the checklist shows neutral (not red) states.

### M01-S03 Verify email with a code (Must)
As a new viewer, I want to enter a 6 digit code from my email, so that I confirm the address is mine.
- AC1: Given I am on `/verify-email`, When I enter the correct code within 15 minutes, Then the account becomes `active` and I go to the profile picker.
- AC2: Given I paste a 6 digit code, When I paste, Then non-numeric characters are removed and the digits fill the slots, with focus on the last slot.
- AC3: Given I type a digit, When the slot fills, Then focus advances; When I press Backspace on an empty slot, Then focus moves back.
- AC4: Given the field uses `inputmode="numeric"` and `autocomplete="one-time-code"`, When the phone offers an SMS or email code suggestion, Then I can accept it.
- Edge: code expired shows "That code has expired. Send a new one." Code used twice is rejected. Entering the code from an older email after a resend is rejected (only the newest code is valid).
- Error: wrong code shows "That code is not right" and counts toward a limit of 5 wrong attempts per code, after which the code is voided and I must resend.
- Empty: not applicable.

### M01-S04 Verify email with a link (Must)
As a new viewer, I want to tap the link in the email instead of typing a code, so that verification takes one tap on my phone.
- AC1: Given the email has a verification link, When I open it within 24 hours on any device, Then the account becomes `active` and I see "Email verified" with a Continue button.
- AC2: Given I open the link on a device where I am not signed in, When it succeeds, Then I am sent to `/sign-in` with a success notice, not signed in automatically.
- AC3: Given the link was already used, When I open it, Then I see "This link was already used" with a Sign in button.
- Edge: link opened in an in-app browser (WhatsApp, Gmail) works without cookies, because the token is the credential.
- Error: expired or tampered link shows an explanation and a "Send a new email" action.
- Empty: not applicable.

### M01-S05 Resend verification email (Must)
As a new viewer, I want to resend the verification email, so that I can recover if it did not arrive.
- AC1: Given I am on `/verify-email`, When I tap Resend, Then a new code and link are sent, the old ones are invalidated, and the button is disabled with a visible 60 second countdown.
- AC2: Given I have requested 3 resends in 1 hour, When I tap again, Then I see "Too many requests. Try again in X minutes." and no email is sent.
- AC3: Given the account is already active, When I open `/verify-email`, Then I am redirected to `/profiles`.
- Edge: the screen offers "Wrong email? Change it" which lets an unverified account fix a typo (re-verifies the new address).
- Error: provider failure shows "We could not send the email. Try again in a minute" and logs the failure (M24), the countdown does not start.
- Empty: not applicable.

### M01-S06 Sign in (Must)
As a returning viewer, I want to sign in with email and password, so that I can reach my profiles.
- AC1: Given valid credentials for an active account, When I submit, Then a session cookie (HttpOnly, Secure, SameSite=Lax) is set and I go to `/profiles` (or to the page I was trying to open).
- AC2: Given invalid credentials, When I submit, Then I see "Email or password is incorrect" without saying which, and the response time is similar whether or not the email exists.
- AC3: Given the account is unverified, When I sign in with the right password, Then I am sent to `/verify-email` with a new code sent automatically (respecting resend limits).
- AC4: Given I came from a deep link such as `/title/xyz`, When I sign in, Then I return to that page afterward (only same-origin paths allowed as `next`).
- Edge: a "Show password" toggle exists. Email field remembers last used email on the device (not the password). Browser password managers can fill.
- Error: network failure keeps the form and offers retry. A suspended account sees "This account is not available. Contact support" with the support address.
- Empty: not applicable.

### M01-S07 Sign-in rate limit and lockout (Must)
As the platform owner, I want repeated failed sign-ins to lock the attempt temporarily, so that guessing passwords is not practical.
- AC1: Given 5 failed attempts for one account within 15 minutes, When the 6th attempt arrives, Then the account is locked for 15 minutes, even a correct password is refused during the lock, and the response is the same generic "Too many attempts. Try again in 15 minutes" message.
- AC2: Given 20 failed attempts from one IP within 15 minutes across any accounts, When another attempt arrives, Then that IP is limited for 15 minutes.
- AC3: Given the lock expires, When I sign in with the correct password, Then it succeeds and counters reset.
- AC4: Given an account becomes locked, When the lock starts, Then the owner receives an email "There were several failed sign-in attempts" with a reset link (rate limited to one such email per hour) and an audit entry is written (M20).
- AC5: Given the lock message is shown, When I look at the screen, Then it shows the minutes remaining (rounded up) without naming the account state beyond "try again".
- Edge: a lock does not log out existing sessions. Shared IPs (mobile carriers use carrier grade NAT) are handled by the higher IP threshold, and the IP limit shows a captcha challenge (Turnstile) before a hard block (Could).
- Error: if the rate limit store is unreachable, the system fails closed for sign in and shows "Sign in is temporarily unavailable" (never open silently).
- Empty: not applicable.

### M01-S08 Forgot password request (Must)
As a viewer who forgot my password, I want to request a reset link, so that I can get back in.
- AC1: Given I enter any well formed email on `/forgot-password`, When I submit, Then I always see "If an account exists, we sent a link" and nothing reveals whether it exists.
- AC2: Given the account exists, When I submit, Then an email with a single use link valid for 1 hour is sent, and previous reset links are invalidated.
- AC3: Given I request more than 3 times in an hour for one address, When I submit again, Then the same message shows but no further email is sent.
- Edge: for an unverified account, the email offers to verify instead. For a suspended account no email is sent.
- Error: provider failure is logged and the viewer still sees the generic message (no leak), plus a "Didn't get it?" help line with the support address.
- Empty: not applicable.

### M01-S09 Reset password (Must)
As a viewer with a reset link, I want to set a new password, so that I can sign in again.
- AC1: Given I open a valid link, When I enter a new password that passes the rules and submit, Then the password changes, all other sessions are revoked, the link is consumed, and I am sent to `/sign-in` with a success notice.
- AC2: Given the link is expired, used or invalid, When I open it, Then I see "This link is no longer valid" with a button to request a new one.
- AC3: Given I choose the same password as my current one, When I submit, Then I am told to choose a different one (Should).
- AC4: Given the password changed, When it completes, Then a "Your password was changed" email is sent (M21) and an audit entry is written.
- Edge: if a lock is active on the account, a successful reset clears the lock.
- Error: network failure keeps the typed password in memory only and offers retry.
- Empty: not applicable.

### M01-S10 Sign out (Must)
As a viewer, I want to sign out, so that nobody else uses my account on a shared device.
- AC1: Given I am signed in, When I choose Sign out from the profile menu, Then the session is revoked server side, cookies cleared, and I land on the Landing page.
- AC2: Given I sign out, When I press Back, Then protected pages do not show cached content and redirect to sign in.
- AC3: Given I am offline, When I choose Sign out, Then the local session is cleared immediately and the server revocation is queued for when I am online.
- Edge: signing out clears the "last profile" remembered for that device only if the user chooses "Forget this device" (Could).
- Error: if revocation fails server side, the cookie is still cleared locally and the failure is logged.
- Empty: not applicable.

### M01-S11 Sign out of all devices (Should)
As a viewer, I want to end every session of my account, so that a lost phone cannot be used.
- AC1: Given I am in Account settings, When I choose "Sign out everywhere" and confirm with my password, Then all sessions are revoked (including this one) and I land on sign in.
- AC2: Given another device is playing, When its session is revoked, Then within 5 minutes (next token refresh) playback stops and it shows sign in.
- Edge: shows a list of sessions with device name, approximate location (country only), last active, and a per-session Revoke.
- Error: wrong password shows the generic incorrect password message and counts toward lockout.
- Empty: a single session shows "This device" only.

### M01-S12 Session expiry and refresh (Must)
As a viewer, I want my session to last without surprise sign-outs, so that I am not interrupted mid-video.
- AC1: Given I use the site at least once in 30 days, When I return, Then I am still signed in (sliding expiry).
- AC2: Given my session expires while I watch, When the next progress write fails with 401, Then the player pauses, I see "Sign in again to keep watching" and sign in returns me to the same video and position.
- AC3: Given the password changed elsewhere, When my next request arrives, Then I am signed out with an explanation.
- Edge: clock differences on cheap phones do not matter because expiry is validated server side.
- Error: a failed refresh with network error is treated as offline, not as sign out.
- Empty: not applicable.

### M01-S13 Return to intended page after auth (Should)
As a visitor following a shared link, I want to land on the title after signing in, so that the link works.
- AC1: Given I choose Sign in from a title page or from a Save dialog, When I am sent to sign in, Then the `next` parameter holds the path and I return to it after sign in and profile pick.
- AC2: Given `next` is an external URL, When I sign in, Then it is ignored and I go to `/profiles`.
- Edge: the title page opens for everyone with a Play button (M40-S05) and Open Graph tags for sharing. A signed out visitor is never redirected to sign in just to view or watch.
- Error: `next` pointing to an unpublished title ends on a 404 page.
- Empty: not applicable.

### M01-S14 Bot protection on sign up (Could)
As the owner, I want a light bot check on sign up, so that fake accounts do not flood my email sending.
- AC1: Given sign up is attempted at a rate above threshold from one IP, When the threshold is crossed, Then a Cloudflare Turnstile challenge is required.
- AC2: Given the challenge is unavailable, When the viewer retries, Then the form remains usable once a fallback (email code only) is satisfied, and the issue is logged.
- Edge: a honeypot field that real users never fill silently rejects bot submissions with the normal success message.
- Edge: the same Turnstile keys protect guest playback after repeated limit hits (M40-S12).
- Error: challenge failure shows "We could not confirm you are human. Try again."
- Empty: not applicable.

---

## M02 Accounts

### M02-S01 View account overview (Must)
As a viewer, I want one page showing my account details, so that I know what is set.
- AC1: Given I am on `/account`, When it loads, Then I see my email (with verified state), plan "Free", member since date, profile count, and links to Security, Playback, Data and Privacy.
- AC2: Given I am in a kids profile, When I try to open `/account`, Then I am shown the password gate (M35) and not the page.
- Edge: long emails truncate in the middle with the full value on tap.
- Error: load failure shows an inline retry card.
- Empty: not applicable.

### M02-S02 Change email (Should)
As a viewer, I want to change my email, so that I keep access if I lose the old one.
- AC1: Given I enter a new email and my current password, When I submit, Then a verification code is sent to the new address and the old address receives a notice, and the change applies only after the code is entered.
- AC2: Given the new email already belongs to another account, When I submit, Then I see the same pending screen (no leak) and the other owner is notified.
- AC3: Given the change completes, When it applies, Then all other sessions are revoked and an audit entry is written.
- Edge: if I never verify, the old email stays valid and the pending change expires after 24 hours.
- Error: wrong password counts toward lockout.
- Empty: not applicable.

### M02-S03 Change password (Must)
As a viewer, I want to change my password while signed in, so that I keep my account safe.
- AC1: Given I give my current password and a valid new one, When I submit, Then the password changes, other sessions are revoked, this session stays, and I get a confirmation email.
- AC2: Given the new password fails rules, When I submit, Then the live checklist shows the failing rules (same component as M01-S02).
- Edge: the new password cannot equal the current one.
- Error: wrong current password shows "Current password is not right" and counts toward lockout.
- Empty: not applicable.

### M02-S04 Playback and display settings per profile (Should)
As a viewer, I want to set autoplay, data saver, default captions and speed memory for each profile, so that each person gets their own habits.
- AC1: Given I open `/settings/playback`, When I toggle autoplay next, Then the change saves instantly (optimistic) for the current profile only.
- AC2: Given the save fails, When the server rejects, Then the toggle rolls back and a persistent error toast appears.
- AC3: Given I use a kids profile, When I look at the screen, Then only parent-approved controls show (Data saver) and the rest are hidden.
- Edge: settings sync across devices for the same profile within a minute.
- Error: offline changes queue locally and sync later with a notice "Saved on this device".
- Empty: not applicable.

### M02-S05 Export my data (Should)
As a viewer, I want to download my data, so that I can see what the platform holds.
- AC1: Given I request an export, When I confirm with my password, Then a job starts and I receive an email with a link valid for 24 hours to a JSON file containing account, profiles, list items and progress. The export includes ratings and notices per profile (M44-S25). It also lists the account's sign in history, the masked Google link and the gifts made while signed in (M49, M48).
- AC2: Given I request more than one export in 24 hours, When I tap again, Then I am told the earlier export is still valid.
- Edge: the export excludes password hash and tokens.
- Error: job failure sends "We could not build your export" and keeps the request retryable.
- Empty: a new account exports a small file with account and one profile.

### M02-S06 Delete my account (Should)
As a viewer, I want to delete my account, so that my data is removed when I leave.
- AC1: Given I choose Delete account and confirm with my password and by typing DELETE, When I submit, Then the account moves to `pending_deletion`, I am signed out everywhere, and I receive an email with a cancel link valid for 14 days.
- AC2: Given I sign in within 14 days, When I open the notice, Then I can cancel the deletion and the account becomes active again.
- AC3: Given 14 days pass, When the scheduled job runs, Then account, profiles, progress and list data are purged and an audit entry keeps only a hashed identifier.
- Edge: kids profile cannot reach this screen.
- Error: purge failure retries via the job queue and alerts the developer (M24).
- Empty: not applicable.

### M02-S07 Profile count limit (Must)
As the owner, I want the number of profiles per account capped, so that accounts are not abused as storage.
- AC1: Given an account has 5 profiles, When I try to add another, Then the Add profile tile is hidden and a message "Up to 5 profiles per account" explains.
- AC2: Given the limit is changed in site config to 6, When the next page loads, Then 6 profiles are allowed.
- Edge: server side enforcement exists regardless of the UI.
- Error: a race that creates a 6th profile fails with a clear error and no partial record.
- Empty: not applicable.

### M02-S08 Account status handling (Must)
As the owner, I want account states to be enforced, so that suspended or locked accounts cannot watch.
- AC1: Given an account is `suspended`, When the viewer signs in, Then they see "This account is not available" and no session is created.
- AC2: Given an account is `pending_deletion`, When the viewer signs in, Then they see the cancel deletion screen only.
- AC3: Given an admin suspends an account while a session is active, When the next request arrives, Then it is rejected and the user is signed out.
- Edge: status changes are audited.
- Error: unknown status defaults to deny.
- Empty: not applicable.

---

## M03 Profiles

### M03-S01 Profile picker after sign in (Must)
As a viewer, I want to choose who is watching after I sign in, so that my history and list are mine.
- AC1: Given I have two or more profiles, When I finish sign in, Then I see `/profiles` with each profile as a large avatar tile and name, and an Add profile tile if under the limit, plus a Manage profiles link.
- AC2: Given I tap a profile, When it loads, Then the profile is stored for this device and I go to Home.
- AC3: Given I have exactly one profile, When I sign in, Then I skip the picker and go to Home (setting "Always ask who is watching" off by default for single profiles).
- AC4: Given a device remembers the last profile, When I open the site while signed in, Then I go straight to that profile's Home, and the header menu offers Switch profile.
- Edge: kids profile tile shows a "Kids" badge. Long names are truncated with an ellipsis.
- Edge: guests never see the picker. Signing in leads here (M40-S06).
- Error: failure to load profiles shows a retry card; sign out is still available.
- Empty: a brand new account shows the Create your first profile flow (M03-S02).

### M03-S02 Create a profile (Must)
As a viewer, I want to create a profile with a name and avatar, so that others in my home can have their own space.
- AC1: Given I tap Add profile, When I enter a name (1 to 20 characters) and choose an avatar, Then the profile is created and appears in the picker.
- AC2: Given a name already exists in my account, When I submit, Then I see "You already have a profile with that name".
- AC3: Given I toggle "Kids profile", When I save, Then the profile is created with the kids flag and a short explanation of what it changes.
- AC4: Given I have no profiles (new account), When the flow starts, Then the name is pre-filled from the email prefix, editable, and the avatar is pre-selected.
- Edge: names are trimmed, internal double spaces collapsed, emoji not allowed (keeps copy clean), slurs blocked by a small word list (Could).
- Error: server failure keeps the form and shows retry.
- Empty: avatar picker always has presets.

### M03-S03 Choose an avatar (Must)
As a viewer, I want to pick an avatar from a set, so that profiles are easy to tell apart.
- AC1: Given the avatar picker is open, When I tap one, Then it is selected with a visible ring and an accessible "selected" state.
- AC2: Given I use keyboard, When I move with arrow keys, Then focus moves between avatars and Space selects.
- AC3: Given a kids profile, When I open the picker, Then it can show a friendlier subset (Could).
- Edge: avatar images are tiny (under 6 KB each) and lazy loaded.
- Error: an avatar that fails to load shows initials on the profile colour.
- Empty: not applicable.

### M03-S04 Edit a profile (Must)
As a viewer, I want to rename or change a profile, so that it stays accurate.
- AC1: Given I open Edit profile, When I change name or avatar and save, Then the change applies at once everywhere (picker, header).
- AC2: Given I change the kids flag from off to on, When I save, Then the profile switches to kids rules at once and Continue Watching and My List hide titles above the kids limit (rank 0) (the data is kept, just hidden).
- AC3: Given I change the kids flag from on to off, When I save, Then I must enter the account password.
- AC4: Given I leave with unsaved changes, When I press Back, Then I am asked to discard or keep editing.
- AC5: Given I open Edit profile on an adult profile, When I change "Allow titles rated up to", Then the new limit applies at once, and raising it needs the account password (M44-S19).
- Edge: editing a profile from inside a kids profile is blocked (M35).
- Error: validation errors map to fields; concurrent edit from another device shows "This profile changed. Reload."
- Empty: not applicable.

### M03-S05 Delete a profile (Must)
As a viewer, I want to delete a profile, so that unused ones disappear with their data.
- AC1: Given I choose Delete on a profile, When I confirm in a dialog that names the profile and says history and list will be removed, Then the profile and its progress and list items are deleted.
- AC2: Given only one profile remains, When I look at it, Then Delete is disabled with the reason "You need at least one profile".
- AC3: Given the profile is currently used on another device, When it is deleted, Then that device returns to the picker on its next request.
- Edge: deleting the last used profile clears the device memory for it.
- Error: server failure leaves the profile untouched with an error toast that persists.
- Empty: not applicable.

### M03-S06 Manage profiles mode (Must)
As a viewer, I want a manage mode in the picker, so that I can edit tiles quickly.
- AC1: Given I tap Manage profiles, When the picker enters manage mode, Then each tile shows a pencil overlay and tapping opens Edit profile; Done returns to normal.
- AC2: Given I am in manage mode, When I press Escape, Then manage mode ends.
- Edge: on desktop the tiles show an Edit label for screen readers.
- Error: not applicable.
- Empty: with one profile, manage shows Edit only.

### M03-S07 Switch profile from the header (Must)
As a viewer, I want to switch profile without signing out, so that the next person can use the device.
- AC1: Given I open the header profile menu, When I choose another profile, Then the app switches to that profile and returns to its Home, clearing profile scoped caches.
- AC2: Given I am watching, When I switch profile, Then playback stops, progress for the current profile is saved first, and then the switch happens.
- Edge: if a PIN is set on the target profile, it is requested (M03-S12).
- Error: switching offline is allowed only for profiles already cached, else a message.
- Empty: not applicable.

### M03-S08 Per profile data separation (Must)
As a viewer, I want my history and list to stay separate from other profiles, so that my recommendations and resume points are mine.
- AC1: Given two profiles on one account, When profile A watches a video, Then profile B's Continue Watching and watched ticks are unaffected.
- AC2: Given the same video is in A's list, When B opens My List, Then it is not there.
- AC3: Given an API call is made with a profile id that is not in the account, When it arrives, Then it returns 403 and is logged.
- Edge: caches (service worker, local storage) are keyed by profile id.
- Error: mismatch of profile and session returns to the picker.
- Empty: new profile starts with empty rows (see M09-S10).

### M03-S09 Profile language and caption defaults (Should)
As a viewer, I want each profile to remember caption preference, so that captions on or off persists.
- AC1: Given I turn captions on in the player, When I watch another video in this profile, Then captions are on by default.
- AC2: Given I change the interface or caption language in the profile form, When I save, Then it applies to this profile only (M46-S01).
- Edge: kids profile defaults captions to on, parent can change.
- Edge: the interface language and the caption language are separate settings; the caption language defaults to the interface language until changed.
- Error: save failure falls back to local storage and syncs later.
- Empty: new profiles default to captions off (adult) or on (kids).

### M03-S10 Kids profile creation rules (Must)
As a parent, I want to mark a profile as kids when I create it, so that children only see suitable titles.
- AC1: Given I create a profile with Kids on, When I save, Then the profile has `is_kids = true` and the picker tile shows a Kids badge.
- AC2: Given I create a kids profile, When the summary is shown, Then it lists the rules: titles rated G only, no account access, password needed to leave.
- Edge: at least one non-kids profile must exist in the account so someone can manage it (the last non-kids profile cannot be set to kids or deleted).
- Error: attempting to remove the last adult profile shows "Keep at least one grown-up profile".
- Empty: not applicable.

### M03-S11 Remember last profile per device (Should)
As a viewer, I want the site to open directly in my profile, so that I do not pick each time.
- AC1: Given I picked a profile on this device, When I reopen the site within the session lifetime, Then Home loads for that profile.
- AC2: Given the remembered profile was deleted, When I open the site, Then the picker shows.
- Edge: a shared family tablet can turn on "Always ask who is watching" in Account settings.
- Edge: a guest has no profile to remember. Kids mode on a guest device is remembered separately (M40-S09).
- Error: local storage blocked means the picker always shows.
- Empty: not applicable.

### M03-S12 Profile PIN (Could)
As a parent, I want to lock a profile with a 4 digit PIN, so that a child cannot open the adult profile.
- AC1: Given I set a PIN on an adult profile, When anyone selects it, Then a PIN screen appears (numeric keypad, `inputmode="numeric"`).
- AC2: Given 5 wrong PIN entries, When the fifth fails, Then PIN entry is locked for 5 minutes on that device and the account password can override.
- Edge: PIN stored as a hash, never shown, reset requires the account password.
- Error: network failure still validates locally only when cached hash available, else asks to retry.
- Empty: not applicable.

### M03-S13 Profile picker on slow networks (Should)
As a viewer on a weak network, I want the picker to appear fast, so that I can start watching.
- AC1: Given a 3G connection, When I land on `/profiles`, Then the tiles show within 2 seconds using the cached profile list from the previous visit, then refresh in the background.
- AC2: Given avatars are not yet loaded, When tiles render, Then initials appear on coloured circles.
- Edge: stale cache beyond 7 days is ignored.
- Error: when the refresh fails, the cached list stays with a small "May be out of date" note.
- Empty: not applicable.

### M03-S14 Profile switch resets the player context (Must)
As a viewer, I want the previous profile's settings and position to never leak, so that privacy is kept.
- AC1: Given I switch profiles, When the next profile opens a video, Then the player uses the new profile's speed, caption and autoplay settings.
- AC2: Given I switch profile mid-session, When I press Back, Then I never see the previous profile's pages from cache.
- Edge: the service worker cache is partitioned by profile for personal endpoints.
- Error: a failed cache purge forces a full reload.
- Empty: not applicable.

---

## M35 Kids mode and content suitability

### M35-S01 Kids profile sees only kid titles (Must)
As a parent, I want kids profiles to show only kid suitable titles, so that children are safe.
- AC1: Given a kids profile is active, When any list is requested (Home, Browse, Search, Related, My List, Continue Watching), Then results contain only titles with maturity rank 0 (G), enforced in the query, not in the UI.
- AC2: Given a direct link to a non-kid title, When a kids profile opens it, Then it shows "This is not available on this profile" with a Back button.
- AC3: Given a title's suitability changes to non-kid, When a kids profile has it in My List, Then it disappears from view at once.
- AC4: Given Kids mode is on for a guest (M40-S09), When any list is requested, Then the same query filter applies.
- AC5: Given an adult profile with a maturity limit (M44-S19), When any list is requested, Then titles above the limit or without a rating never appear, enforced in the query.
- Edge: a series is shown to a profile only when the series and at least one live episode are within the profile limit.
- Edge: for guests the filter follows the device setting and is not a lock.
- Error: filter failure returns an empty list, never an unfiltered one (fail closed).
- Empty: when no kid titles exist, Home shows "Nothing here yet. Ask a grown-up to switch profile."

### M35-S02 Kids navigation limits (Must)
As a parent, I want kids profiles to avoid account and profile management, so that settings are not changed by accident.
- AC1: Given a kids profile is active, When I open the header menu, Then it shows Switch profile and Exit kids mode only.
- AC2: Given a kids profile, When the URL `/account` or `/profiles/manage` is opened, Then the password gate appears.
- Edge: Search is available but limited to kid titles.
- Error: not applicable.
- Empty: not applicable.

### M35-S03 Exit kids profile with password (Must)
As a parent, I want to need my password to leave kids mode, so that children cannot skip it.
- AC1: Given I choose Exit kids mode, When I enter the correct account password, Then I go to the profile picker.
- AC2: Given I enter a wrong password 5 times, When the fifth fails, Then the same lockout as sign in applies (M01-S07).
- AC3: Given the password dialog, When it opens, Then focus is in the field and Escape closes it.
- Edge: switching to another kids profile does not need a password.
- Edge: guest Kids mode needs no password: it is a convenience (M40-S09).
- Error: network failure shows retry and keeps kids mode.
- Empty: not applicable.

### M35-S04 Admin sets title maturity rating (superseded by M44-S18, kept for kids filtering) (Must)
As an admin, I want to mark each title on a five step maturity scale, so that kids profiles are filtered correctly.
- AC1: Given I edit a video, When I set the maturity rating, Then it saves and an audit entry records the change.
- AC2: Given suitability is not set, When I try to publish, Then publishing is blocked until a maturity rating is chosen (no default, so nothing is rated G by accident).
- AC3: Given I bulk select videos, When I apply a maturity rating, Then all selected update atomically.
- Edge: for a series, setting suitability can cascade to episodes with a confirm step.
- Error: partial bulk failure reports the failed ids and rolls back none or all (all or nothing).
- Empty: not applicable.

---
## M04 Catalog

### M04-S01 Only published titles reach viewers (Must)
As a viewer, I want to see only finished, published titles, so that I never hit a broken or half ready video.
- AC1: Given a video is `draft`, `processing`, `ready`, `unpublished` or `archived`, When any viewer API is called, Then it is not returned.
- AC2: Given a video is `scheduled` with a future time, When viewers browse, Then it is hidden until the scheduled time.
- AC3: Given a direct URL to a hidden title, When opened, Then it returns the 404 page with the same layout as any missing page (no leak that it exists).
- Edge: an admin previewing as a viewer (M16-S08) sees hidden titles only inside the preview mode.
- Error: a query failure returns the error state, never a partial list.
- Empty: an empty catalog shows the "Coming soon" Home (M05-S07).

### M04-S02 Stable slugs and redirects (Should)
As a viewer who shared a link, I want links to keep working after a title is renamed, so that shared links do not break.
- AC1: Given a title is renamed, When the slug changes, Then the old slug redirects with 301 to the new slug.
- AC2: Given two titles would share a slug, When saved, Then a numeric suffix is added (`-2`).
- Edge: slugs are lowercase ASCII, hyphen separated, up to 80 characters, accents transliterated.
- Error: reserved words (`admin`, `api`, `watch`) are refused.
- Empty: not applicable.

### M04-S03 Series structure (Must)
As the owner, I want series with seasons and ordered episodes, so that multi-part courses play in order.
- AC1: Given a series with episodes, When the series page loads, Then episodes are ordered by season number then episode number.
- AC2: Given a series with no published episodes, When viewers browse, Then the series is hidden.
- AC3: Given a single video is later turned into an episode, When saved, Then its title page redirects to the series page with that episode focused.
- Edge: episodes without a season are treated as season 1.
- Error: duplicate episode numbers in one season are rejected on save.
- Empty: not applicable.

### M04-S04 Category assignment (Must)
As the owner, I want a title in more than one category, so that it appears wherever it is useful.
- AC1: Given a title has categories A and B, When browsing A or B, Then the title appears in both.
- AC2: Given a category is hidden, When viewers browse, Then it is not listed and its titles still appear elsewhere.
- Edge: category with zero published titles is hidden from viewers automatically.
- Error: unknown category id returns 422.
- Empty: not applicable.

### M04-S05 Catalog read performance (Should)
As a viewer on a slow network, I want catalog pages to respond quickly, so that Home feels fast.
- AC1: Given the launch catalog (about 100 videos), When Home data is requested, Then p95 server time is under 300 ms and the payload under 40 KB gzip for the first 3 rows.
- AC2: Given catalog data rarely changes, When requests repeat, Then responses are cached for 60 seconds at the server and revalidated with ETag, except personal rows.
- Edge: cache is invalidated when admin publishes or edits.
- Error: stale cache is never served beyond 5 minutes if the database is unreachable (shows error instead).
- Empty: not applicable.

---

## M05 Home and rows

### M05-S01 Hero banner (Must)
As a viewer, I want a featured title at the top of Home, so that I see something worth watching at once.
- AC1: Given Home loads, When a hero is configured, Then I see poster art, title, a one-line description, a Play (or Resume) button and a More info button.
- AC2: Given multiple hero titles are set, When I wait, Then they rotate every 20 seconds (site setting) with visible dots and a Pause control, and rotation stops under reduced motion or Data saver. See M41-S02.
- AC3: Given I tap Play, When the title is a series, Then it plays the next unwatched episode for my profile.
- AC4: Given a fast connection, Data saver off and no reduced motion, When a slide with a ready clip is shown, Then an optional muted preview clip may play over the still. See M41-S11.
- Edge: text over the image keeps WCAG contrast through a gradient scrim.
- Error: if the hero image fails to load, a solid theme colour with the title still shows.
- Empty: with no hero configured, the 5 newest published titles rotate as the hero (M41-S03).

### M05-S02 Horizontal rows (Must)
As a viewer, I want rows of titles I can scroll sideways, so that I can scan many titles quickly.
- AC1: Given a desktop at 1280 px or wider, When a row renders, Then 5.3 cards are visible so the next card peeks (2.3 on phones, 3.3 from 600 px, 4.3 from 960 px, 6.3 from 1920 px).
- AC2: Given a touch device, When I swipe the row, Then it scrolls with momentum and snaps to cards, and the page does not scroll vertically while I swipe horizontally.
- AC3: Given a desktop with a mouse, When I hover the row, Then previous and next arrows appear, and Left and Right arrows scroll when a card is focused.
- AC4: Given a row has a View all target, When I hover the row (or on touch), Then a View all link shows beside the heading and opens the section list page (M41-S08, M41-S09).
- Edge: the row types Trending now, Top 10 and Most liked follow the same card and arrow rules (M44-S07, S09, S10).
- Edge: row heading is a real heading (h2) and cards are in a list for screen readers.
- Error: a row that fails shows an inline "Could not load this row. Retry" while other rows still render.
- Empty: rows with no items are not rendered.

### M05-S03 Title cards (Must)
As a viewer, I want each card to show poster, title and duration, so that I can choose.
- AC1: Given a card renders, When I look at it, Then I see a 16:9 poster, title (two lines max), duration, and a progress bar if started.
- AC2: Given a hover capable device with a fine pointer, When I rest on a card for 300 ms, Then a hover card shows title, length, subject, description, the maturity label (unless G), a Most liked label when earned, and quick actions (Play, My List, rating, More info), with no video preview (data friendly). Keyboard focus shows the card actions but does not open it (M41-S14).
- AC3: Given a touch device, When I tap a card, Then it opens the Title detail page.
- Edge: Data saver loads the smallest poster (320 px).
- Error: missing poster shows a branded placeholder with the title text.
- Empty: not applicable.

### M05-S04 Rows load lazily (Must)
As a viewer on mobile data, I want below-the-fold rows to load only when needed, so that I use less data.
- AC1: Given Home loads, When the first screen renders, Then only the hero and the first 2 rows request data and posters, and further rows load when within 1 viewport of the screen.
- AC2: Given rows are loading, When they appear, Then skeletons with matched geometry show after 300 ms with no layout shift.
- Edge: with Save-Data on, rows load on explicit scroll proximity of 0.5 viewport.
- Error: a failed row can be retried individually.
- Empty: not applicable.

### M05-S05 Personal rows first (Must)
As a viewer, I want Continue Watching and My List at the top, so that my own things are one tap away.
- AC1: Given I have Continue Watching items, When Home loads, Then the Continue learning row (title configurable) is first below the hero (or above it on mobile per curation setting).
- AC2: Given My List has items, When Home loads, Then My List row follows.
- AC3: Given the editor moved these rows in curation (M17), When Home loads, Then the configured order applies.
- Edge: rows are hidden when empty (no empty headings).
- Edge: the Continue Watching card follows M44-S23.
- Edge: guests have no My List row. A Continue Watching row appears from this device's progress (M40-S14).
- Error: personal rows failing do not block the curated rows.
- Empty: a new profile or a guest without device progress sees curated rows only.

### M05-S06 Home on a kids profile (Must)
As a child, I want a simple Home with big cards, so that I can find videos on my own.
- AC1: Given a kids profile, When Home loads, Then only kid titles appear and the hero comes from kid titles.
- AC2: Given the profile, When the header renders, Then it shows no search suggestions of adult titles and no account link.
- AC3: Given Kids mode is on for a guest, When Home loads, Then AC1 applies and the header shows only the logo mark (M40-S09).
- Edge: cards are larger on kids Home from 600 px, and 2.3 per row on mobile like the adult rows (R11).
- Error: same as adult Home, retry per row.
- Empty: see M35-S01.

### M05-S07 Empty catalog state (Must)
As a first visitor before launch content exists, I want a friendly page, so that the site is not broken.
- AC1: Given no published titles exist, When I open Home, Then I see "New videos are on the way" with the platform name and a link to About.
- AC2: Given an admin views Home with no content, When it loads, Then an extra link "Add your first video" shows only for admins.
- Edge: no empty rows are shown.
- Error: not applicable.
- Empty: this is the empty state.

### M05-S08 Home error and offline states (Must)
As a viewer, I want clear messages when Home cannot load, so that I know what to do.
- AC1: Given the API fails, When Home loads, Then an error card says "We could not load Home" with a Retry button and the header remains usable.
- AC2: Given I am offline, When I open Home, Then the cached shell plus last known rows show with an "Offline. Showing saved view" banner, and Play shows a not available offline message.
- Edge: retry uses exponential backoff on automatic attempts (1 s, 3 s, 9 s, then manual).
- Error: this is the error state.
- Empty: not applicable.

---

## M06 Browse and search

### M06-S01 Browse by category (Must)
As a viewer, I want to browse titles by category, so that I can find a subject I care about.
- AC1: Given I open `/browse`, When it loads, Then I see category chips (scrollable on mobile) and a grid or rows of titles.
- AC2: Given I select a category, When it applies, Then the URL becomes `/browse/<slug>`, the list updates without a full reload, and the chip shows active state (solid fill).
- AC3: Given I use Back, When I return, Then the previous state and scroll position restore.
- Edge: category names with long text wrap inside the chip or truncate with a tooltip.
- Error: failed load shows retry in the grid area, chips remain.
- Empty: a category with no published titles is hidden. If reached by URL, it shows "Nothing in this category yet".

### M06-S02 Sort and filter (Should)
As a viewer, I want to sort by newest, shortest or A to Z and filter by length, so that I can pick something that fits my time.
- AC1: Given I choose "Under 3 minutes", When it applies, Then only titles with duration under 180 seconds show and the filter appears as a removable chip.
- AC2: Given I choose Sort: Newest, When it applies, Then the order is by publish date descending, with the choice kept in the URL.
- AC3: Given filters produce nothing, When the grid renders, Then it shows "No videos match. Clear filters" with a Clear button.
- Edge: filter and sort persist per session, not per account.
- Error: invalid query values in the URL are ignored with defaults applied.
- Empty: see AC3.

### M06-S03 Search as I type (Must)
As a viewer, I want results to appear as I type, so that I find titles quickly.
- AC1: Given I open Search, When I type 2 or more characters and pause 250 ms, Then results update (debounced) and a loading state appears only if the wait exceeds 300 ms.
- AC2: Given I press Enter, When results show, Then the URL is `/search?q=...` so the page can be shared and restored.
- AC3: Given I clear the field, When it empties, Then recent searches or suggestions show.
- Edge: queries are trimmed, case and accent insensitive, up to 80 characters.
- Error: failure shows "Search is unavailable right now. Try again" and keeps the query.
- Empty: with no query, show popular categories and recent searches.

### M06-S04 Tolerant matching (Should)
As a viewer who mistypes, I want search to forgive small errors, so that I still find the video.
- AC1: Given I type "budgetng", When searching, Then "budgeting" titles appear (trigram similarity).
- AC2: Given I search by a category name or tag, When results return, Then titles in that category appear.
- AC3: Given Pidgin or Yoruba words appear in descriptions, When I search them, Then matches are found (no stemming that breaks them).
- Edge: results rank title matches above description matches, then by popularity (recent views) as a tie break.
- Error: not applicable.
- Empty: see M06-S05.

### M06-S05 No results state (Must)
As a viewer, I want help when nothing matches, so that I do not hit a dead end.
- AC1: Given a query with no matches, When results render, Then I see "No results for 'xyz'" with tips (check spelling, try fewer words) and a row of popular titles.
- AC2: Given I am on a kids profile, When results are empty, Then only kid popular titles show.
- Edge: queries are logged anonymously for the admin "searches with no results" report (Could, M19).
- Error: not applicable.
- Empty: this is the empty state.

### M06-S06 Search suggestions (Could)
As a viewer, I want suggestions as I type, so that I type less on a phone.
- AC1: Given I type 2 characters, When suggestions load, Then up to 5 title and category suggestions show and arrow keys plus Enter select.
- AC2: Given I tap a suggestion, When selected, Then I go directly to that title or category.
- Edge: suggestions use the same kids filter.
- Error: suggestion failure is silent (full search still works).
- Empty: not applicable.

### M06-S07 Recent searches per profile (Could)
As a viewer, I want my last searches listed, so that I can repeat them.
- AC1: Given I searched before, When I focus the search box, Then up to 8 recent searches show with a remove icon each and Clear all.
- AC2: Given I switch profile, When I open Search, Then I see that profile's searches only.
- Edge: kids profiles store none.
- Error: storage failure hides the list silently.
- Empty: nothing shown, only categories.

### M06-S08 Search from keyboard and mobile (Must)
As a viewer, I want to open search quickly, so that I can search from anywhere.
- AC1: Given I am on desktop, When I press `/`, Then the search box focuses (unless typing in a field).
- AC2: Given I am on mobile, When I tap the search icon in the header, Then a full screen search opens with the keyboard visible and the Cancel action reachable.
- Edge: Escape closes search and returns focus to the trigger.
- Error: not applicable.
- Empty: not applicable.

### M06-S09 Search result layout and loading (Must)
As a viewer, I want results presented as a clear list of cards, so that I can scan them.
- AC1: Given results exist, When they render, Then titles and series are shown in one grid with a type badge (Series, Video), count shown "12 results".
- AC2: Given results are loading after the first, When new input arrives, Then the old results stay until new ones are ready (no flicker) with a thin progress line.
- Edge: pagination loads in pages of 24 by cursor with a "Show more" button (data friendly, no infinite scroll when Save-Data is on).
- Error: partial page failure keeps earlier results and shows retry at the bottom.
- Empty: see M06-S05.

### M06-S10 Search rate limiting and abuse safety (Should)
As the owner, I want search protected from abuse, so that the database stays responsive.
- AC1: Given an IP makes more than 60 searches per minute, When the next arrives, Then it returns 429 and the UI shows "Slow down a little".
- AC2: Given a query contains special characters, When it runs, Then it is parameterised and cannot alter the query.
- Edge: signed out visitors can search. Their limit is per IP and per guest id (60 per minute), and their searches are not saved on the server.
- Error: 429 handling shows a countdown.
- Empty: not applicable.

---

## M07 Title detail and series page

### M07-S01 Title detail page (Must)
As a viewer, I want a page that explains a video before I play it, so that I know if it suits me.
- AC1: Given I open `/title/<slug>`, When it loads, Then I see the poster, title, duration, categories, description, caption badge (CC), maturity label, Most liked label when earned, the rating group (M44-S01), and primary button Play (or Resume from 2:14).
- AC2: Given I started the video, When I look at the page, Then a progress bar shows with remaining time.
- AC3: Given I tap My List, When it toggles, Then the button updates at once (optimistic) with an accessible pressed state.
- AC4: Given I am a guest, When I tap My List, Then the Sign in to save dialog opens (M40-S07) and the button state does not change.
- Edge: long descriptions collapse after 4 lines with "More".
- Edge: for guests Resume uses progress kept on this device (M40-S04).
- Error: not found shows the 404 page. Load failure shows retry.
- Empty: not applicable.

### M07-S02 Series page with seasons and episodes (Must)
As a viewer, I want to see all episodes of a series, so that I can watch in order or choose one.
- AC1: Given I open `/series/<slug>`, When it loads, Then I see the series header and an episode list with number, poster, title, duration, description snippet, and progress.
- AC2: Given multiple seasons exist, When I use the season selector, Then the list switches without a full reload and the choice is in the URL.
- AC3: Given I have progress, When the page loads, Then the primary button says "Resume S1 E3" or "Play S1 E1" and the unfinished episode is highlighted.
- AC4: Given an episode is finished, When shown, Then it has a watched tick.
- Edge: a series with one season hides the selector.
- Error: unpublished episodes are not listed.
- Empty: a series with no published episode is a 404.

### M07-S03 Play or Resume button logic (Must)
As a viewer, I want the main button to do the right thing, so that I never have to think.
- AC1: Given I have never watched, When I tap Play, Then playback starts at 0.
- AC2: Given I have a saved position of 5 seconds or more and not finished, When I tap Resume, Then playback starts at position minus 3 seconds.
- AC3: Given I finished the title, When I view the page, Then the button says "Watch again" and starts at 0.
- AC4: Given the title is a series, When I tap Play, Then the next unwatched episode starts.
- Edge: a "Start from beginning" secondary link appears when resuming.
- Edge: For guests the saved position comes from this device (M40-S04).
- Error: not applicable.
- Empty: not applicable.

### M07-S04 Share a title (Should)
As a viewer, I want to share a title link, so that friends can open it from WhatsApp.
- AC1: Given I tap Share on a phone, When the Web Share API is available, Then the native sheet opens with title and URL.
- AC2: Given Web Share is not available, When I tap Share, Then the link is copied and a toast "Link copied" shows.
- AC3: Given the link is pasted in WhatsApp, When it renders, Then the preview shows poster, title and description via Open Graph tags.
- Edge: shared links carry no personal data, only the slug.
- Error: clipboard failure shows the URL in a selectable box.
- Empty: not applicable.

### M07-S05 Related titles (Should)
As a viewer, I want suggestions on a title page, so that I can keep learning.
- AC1: Given a title, When the page loads, Then a "More like this" row shows up to 12 titles sharing a category, excluding the current one and respecting the kids filter and the profile maturity limit.
- AC2: Given no related titles exist, When the page loads, Then the row is not rendered.
- Edge: results are cached 5 minutes.
- Error: failure hides the row silently.
- Empty: see AC2.

### M07-S06 Public preview when guest play is off (Should)
As a visitor with a shared link, I want to see what the title is before signing up, so that I decide to join.
- AC1: Given the owner has switched guest play off, When I open `/title/<slug>` signed out, Then I see poster, title, description and a Sign in to watch button, with no player.
- AC2: Given I tap the button, When I go through sign in, Then I return to the title.
- AC3: Given I am signed out and tap a rating or My List, When the dialog opens, Then it is the Sign in to save dialog and my choice is applied after sign in (M44-S04).
- Edge: search engines can index the page (title, description, Open Graph).
- Edge: with guest play on, the page is the full title page (M40-S05).
- Error: not applicable.
- Empty: not applicable.

### M07-S07 Episode list actions (Should)
As a viewer, I want to play any episode directly, so that I can skip or revisit.
- AC1: Given an episode row, When I tap it, Then the Watch page opens for that episode.
- AC2: Given an episode is partly watched, When shown, Then a progress bar sits under the thumbnail.
- AC3: Given I long-press or open the menu, When I choose "Mark as watched" (Could), Then the episode is marked finished for my profile.
- Edge: keyboard users move through episodes with Tab and Enter.
- Error: failure on mark shows a toast and rolls back.
- Empty: not applicable.

---

## M08 Player

### M08-S01 Start playback (Must)
As a viewer, I want a video to start quickly when I press Play, so that I do not wait.
- AC1: Given I open `/watch/<id>`, When the page loads, Then the player shell (with poster) renders in under 1 second on broadband and playback begins as soon as the first segments arrive.
- AC2: Given autoplay is blocked by the browser, When the page opens from a tap, Then playback still starts (user gesture), else a large Play button is shown.
- AC3: Given the master playlist request returns a signed URL, When the player loads, Then it uses hls.js (or native HLS on Safari).
- AC4: Given a 3G connection, When playback starts, Then the first rendition is the 360p (start low, then adapt up).
- AC5: Given I have no account, When I press Play, Then playback starts the same way with no sign in step (M40-S02).
- Edge: Startup time and first frame time are measured and sent to observability (M24).
- Error: see M08-S20 to M08-S24.
- Empty: not applicable.

### M08-S02 Play and pause (Must)
As a viewer, I want to play and pause, so that I control the video.
- AC1: Given the video plays, When I tap or click the video area, Then it pauses and the control bar shows. On desktop a click toggles, on touch a single tap shows controls and a second tap on the play icon toggles.
- AC2: Given I press Space or K, When focus is in the player, Then it toggles.
- AC3: Given the page loses visibility (tab hidden), When it hides, Then audio keeps playing unless the viewer paused (default), and progress is saved.
- Edge: pausing saves progress at once.
- Error: not applicable.
- Empty: not applicable.

### M08-S03 Seek bar and time (Must)
As a viewer, I want to drag to any point, so that I can move through the video.
- AC1: Given the seek bar, When I drag or tap a point, Then playback jumps there and the buffered range shows.
- AC2: Given I use Left and Right arrows, When pressed, Then it seeks 5 seconds (J and L seek 10 seconds), and Home and End jump to start or near end.
- AC3: Given I hover or drag, When over the bar, Then a time tooltip shows (and a preview image when sprites exist).
- AC4: Given time labels, When shown, Then they display current and remaining time, with a toggle for total.
- Edge: seeking beyond the buffered range shows buffering without losing the position.
- Error: seek failure retries once then falls back to the nearest segment start.
- Empty: not applicable.

### M08-S04 Double tap seek on touch (Should)
As a mobile viewer, I want to double tap the left or right side to skip, so that I can jump quickly.
- AC1: Given touch on the video, When I double tap the right third, Then it seeks forward 10 seconds with a ripple and "+10" label; left third seeks back 10 seconds.
- AC2: Given repeated double taps, When continuing, Then seek accumulates (20, 30 seconds).
- Edge: double tap in the centre toggles play.
- Error: not applicable.
- Empty: not applicable.

### M08-S05 Volume and mute (Must)
As a viewer, I want to change volume and mute, so that I control sound.
- AC1: Given a desktop, When I use the slider or Up and Down arrows, Then volume changes by 5 percent steps, M toggles mute.
- AC2: Given mobile, When I look at controls, Then no volume slider shows (device volume is used) and a mute button remains.
- AC3: Given I mute and return, When I reload, Then the mute state persists in this profile on this device.
- Edge: videos without an audio track hide the volume control.
- Error: not applicable.
- Empty: not applicable.

### M08-S06 Full screen and orientation (Must)
As a viewer, I want full screen playback, so that I can see detail.
- AC1: Given I tap the full screen button or press F, When toggled, Then the player enters full screen and Escape exits.
- AC2: Given a phone in portrait, When I enter full screen, Then it requests landscape orientation lock where supported and releases it on exit.
- AC3: Given iOS Safari, When I go full screen, Then native full screen is used with captions retained.
- Edge: double click on desktop toggles full screen.
- Error: if the browser denies full screen, a toast explains and the inline player stays.
- Empty: not applicable.

### M08-S07 Controls auto hide (Must)
As a viewer, I want controls to disappear while playing, so that the video is unobstructed.
- AC1: Given playback is running, When 3 seconds pass without input, Then controls fade out (and the cursor hides on desktop).
- AC2: Given I move the pointer, tap, or press a key, When input occurs, Then they return at once.
- AC3: Given a keyboard user focuses a control, When focus is inside the controls, Then they stay visible.
- Edge: with reduced motion on, controls hide without animation.
- Error: not applicable.
- Empty: not applicable.

### M08-S08 Keyboard shortcuts (Must)
As a keyboard or desktop viewer, I want standard shortcuts, so that I can control playback without a mouse.
- AC1: Given focus is in or on the player, When I press Space or K, Then play or pause; F full screen; M mute; C captions; Left or Right 5 seconds; J or L 10 seconds; Up or Down volume; 0 to 9 jump to 0 to 90 percent; Shift plus Comma or Period slower or faster; N next episode.
- AC2: Given I press the question mark key, When pressed, Then a shortcuts help dialog opens (focus trapped, Escape closes).
- AC3: Given I type in an input elsewhere, When a shortcut key is pressed, Then it is ignored.
- Edge: shortcuts do not clash with screen reader keys (they work only when the player region has focus).
- Error: not applicable.
- Empty: not applicable.

### M08-S09 Touch controls and tap targets (Must)
As a mobile viewer, I want large controls, so that I can use the player with one thumb.
- AC1: Given a phone, When controls show, Then each button is at least 44 by 44 CSS pixels with 8 px spacing.
- AC2: Given portrait, When controls show, Then the primary row (play, seek bar, full screen) is within the lower third of the screen.
- AC3: Given a notch or gesture bar, When rendering, Then safe area insets are respected.
- Edge: one handed use does not need precise taps on a thin seek bar (touch area is extended vertically to 32 px).
- Error: not applicable.
- Empty: not applicable.

### M08-S10 Playback speed (Must)
As a viewer, I want to change playback speed, so that I can learn at my pace.
- AC1: Given the speed menu, When I open it, Then options are 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x with 1x marked default.
- AC2: Given I choose 1.5x, When applied, Then audio pitch is preserved and the choice persists for this profile.
- AC3: Given captions are on, When speed changes, Then captions remain in sync.
- Edge: a kids profile limits speed to 0.75x to 1.25x (Could).
- Error: unsupported speed in a browser falls back to the nearest and informs by toast.
- Empty: not applicable.

### M08-S11 Quality menu (Must)
As a viewer, I want to choose video quality, so that I balance clarity and data.
- AC1: Given the quality menu, When I open it, Then I see Auto (current level in brackets), 1080p, 720p, 480p, 360p, listing only renditions that exist for the video.
- AC2: Given I choose 480p, When applied, Then ABR is locked to 480p and switching happens at the next segment boundary, with the choice shown on the button.
- AC3: Given Data saver is on, When the menu opens, Then 720p and 1080p are disabled with a hint "Turn off Data saver to use higher quality".
- AC4: Given Auto, When the network changes, Then the player switches up or down automatically without interrupting playback.
- Edge: the manual choice is not persisted across videos by default (Auto each time) unless "Remember quality" is on (Could).
- Error: a rung that fails to load is skipped and Auto continues.
- Empty: a video with a single rendition hides the menu.

### M08-S12 Captions control in the player (Must)
As a viewer, I want to turn captions on or off from the player, so that I can read along.
- AC1: Given an approved caption track exists, When I tap the CC button, Then captions toggle and the button shows state.
- AC2: Given the menu lists approved languages (M46-S14), When I choose one, Then the track switches immediately and my choice is remembered for this profile.
- AC3: Given no approved track exists, When I look at the controls, Then the CC button is hidden (not disabled) and the title page shows no CC badge.
- Edge: captions render above the control bar when controls show.
- Error: a track that fails to load shows a toast "Captions could not load" and playback continues.
- Empty: see AC3.

### M08-S13 Autoplay next episode or suggestion (Must)
As a viewer, I want the next episode to start by itself, so that I can keep learning without touching the phone.
- AC1: Given an episode finishes and Autoplay next is on, When the end is reached, Then an "Up next" card with title, poster and a 5 second countdown shows with Play now and Cancel.
- AC2: Given I tap Cancel, When pressed, Then the countdown stops and the card stays with Play next and Back to series.
- AC3: Given Autoplay is off, When the video ends, Then the end screen shows the Up next card without a countdown.
- AC4: Given the video is a standalone title, When it ends, Then Up next shows the best related title in the same category (not already finished), skipped when none exists.
- AC5: Given Data saver is on, When the countdown begins, Then the next video is not prefetched until Play now or the countdown completes.
- Edge: after 3 consecutive autoplayed episodes with no interaction, ask "Still watching?" (Could) to avoid wasted data.
- Error: next episode fetch failure shows the error state with Retry and Back to series.
- Empty: with no next title, the end screen shows Replay and Back.

### M08-S14 Up next tile during playback (Should)
As a viewer, I want to see what is next while I am finishing, so that I can jump ahead.
- AC1: Given the remaining time is 15 seconds or less, When the video plays, Then a small "Next: <title>" tile slides in at the bottom right and can be dismissed.
- AC2: Given I tap the tile, When pressed, Then the next title starts.
- Edge: tile is not shown on the last episode.
- Error: not applicable.
- Empty: not applicable.

### M08-S15 Resume from saved position (Must)
As a viewer, I want the video to start where I stopped, so that I never find my place.
- AC1: Given a saved position of 5 seconds or more, When I open the watch page, Then playback starts at position minus 3 seconds with a toast "Resumed from 2:14. Start over" action.
- AC2: Given I tap Start over, When pressed, Then playback seeks to 0 and the saved position resets.
- AC3: Given the URL has `?t=90`, When opened, Then it overrides saved position for that load.
- AC4: Given I am a guest, When I open the watch page, Then the saved position comes from this device (M40-S04).
- Edge: if the saved position is beyond the current duration (video replaced), it is ignored and starts at 0.
- Error: failure to fetch the position starts at 0 and does not block playback.
- Empty: not applicable.

### M08-S16 Progress reporting (Must)
As a viewer, I want my place saved reliably, so that I can resume on any device.
- AC1: Given playback runs, When 10 seconds elapse, Then the client sends the position (idempotent) with profile id, video id, position and duration.
- AC2: Given I pause, seek, or hide the tab, When that happens, Then a write is sent at once.
- AC3: Given the page closes, When `pagehide` fires, Then a `sendBeacon` write is attempted.
- AC4: Given the network is offline, When writes fail, Then the latest position is queued locally (only the newest per video) and sent when back online.
- AC5: Given I am a guest, When progress is due, Then it is written to this device only and no request goes to `/api/progress` (M40-S04).
- Edge: writes are rate limited per profile to 1 per 5 seconds on the server, extra ones coalesced.
- Error: a 401 pauses playback and prompts sign in (M01-S12) for signed in viewers. A guest session that cannot start shows 'We could not start this video. Try again' with Retry. A 403 for profile mismatch returns to the picker.
- Empty: not applicable.

### M08-S17 Buffering indicators (Must)
As a viewer, I want to know the player is loading, so that I am not confused by a frozen screen.
- AC1: Given the video stalls, When it exceeds 500 ms, Then a spinner shows over the video (no text), and after 8 seconds the text "Slow connection. Switching to lower quality" shows if Auto is on.
- AC2: Given a stall lasts more than 20 seconds, When time passes, Then the error recovery flow begins (M08-S20).
- AC3: Given the stall ends, When playback resumes, Then the spinner disappears within 300 ms.
- Edge: stalls are counted for the rebuffer ratio metric.
- Error: see recovery.
- Empty: not applicable.

### M08-S18 Poor network adaptation (Must)
As a viewer on 3G, I want the player to drop quality instead of freezing, so that I keep watching.
- AC1: Given measured bandwidth falls below the current rendition bitrate, When two segments are late, Then ABR drops one level and the buffer target is kept at 30 seconds.
- AC2: Given Data saver is on, When ABR runs, Then it never goes above 360p.
- AC3: Given bandwidth recovers, When it is stable for 3 segments, Then ABR steps up one level at a time.
- Edge: initial bandwidth estimate is seeded from the last session on this device to avoid a too-high first rung.
- Error: not applicable.
- Empty: not applicable.

### M08-S19 Picture in picture and lock screen controls (Should)
As a viewer, I want to keep watching while I use another app, so that I can multitask.
- AC1: Given PiP is supported, When I tap the PiP button, Then the video floats and controls remain.
- AC2: Given the Media Session API, When playing, Then the lock screen shows title, poster, play and pause, seek forward and back.
- Edge: the PiP button is hidden where unsupported.
- Error: PiP denial shows a toast.
- Empty: not applicable.

### M08-S20 Network error recovery (Must)
As a viewer, I want the video to recover from a brief network failure, so that I do not have to reload.
- AC1: Given a segment request fails, When retried, Then the player retries 3 times with backoff (1 s, 2 s, 4 s) and continues if one succeeds.
- AC2: Given all retries fail, When the buffer empties, Then I see "Connection lost" with a Retry button, the position is kept, and the player auto retries when the network returns.
- AC3: Given the browser fires `online`, When connectivity returns, Then playback resumes from the same position without a page reload.
- Edge: if the failure is on one rendition only, the player drops to a lower rendition before showing the error.
- Error: this story defines the error state.
- Empty: not applicable.

### M08-S21 Expired URL and key refresh (Must)
As a viewer, I want long sessions to continue past the signed URL lifetime, so that playback is not cut off.
- AC1: Given signed URLs last 2 hours (tokens refresh every 30 minutes), When a token nears expiry during playback, Then the player silently requests a fresh one and continues.
- AC2: Given a 403 on a segment or key, When it occurs, Then the player fetches a fresh signature once and retries before showing an error.
- AC3: Given the refresh is refused (video unpublished or session revoked), When it fails, Then the player stops and shows "This video is no longer available" or "Sign in again".
- Edge: key requests count against a rate limit that allows normal seeking.
- Error: see AC3.
- Empty: not applicable.

### M08-S22 Unsupported format or decode failure (Must)
As a viewer on an old device, I want a clear message and a fallback, so that I am not left with a black box.
- AC1: Given the media element reports a decode error, When it occurs, Then the player tries a lower rendition and then shows "This video cannot play on this device" with a link to Help.
- AC2: Given the browser lacks MSE and native HLS, When the page loads, Then a plain message lists supported browsers.
- Edge: errors are reported with codes to observability (M24).
- Error: this story defines the error state.
- Empty: not applicable.

### M08-S23 Video not found or removed (Must)
As a viewer opening an old link, I want a clear message if the video is gone, so that I can go elsewhere.
- AC1: Given the video is unpublished or deleted, When I open its watch URL, Then I see the not found page with Search and Home links.
- AC2: Given it becomes unpublished mid-watch, When the next token refresh runs, Then playback stops after the current segment with a message.
- Edge: current progress is still saved.
- Error: see AC1.
- Empty: not applicable.

### M08-S24 Offline behaviour in the player (Must)
As a viewer who loses signal, I want to see what happened and keep my place, so that I can continue later.
- AC1: Given I go offline while playing, When buffered video runs out, Then the player pauses with "You are offline" and a Retry button.
- AC2: Given I go offline before opening a video, When I open the watch page, Then I see the Offline screen with Back (no playback offline in phase 1).
- AC3: Given I return online, When connectivity is detected, Then I am offered "Back online. Resume" or it auto resumes if I was playing.
- Edge: the buffered video continues to play offline until it is exhausted.
- Error: queued progress writes are sent on return.
- Empty: not applicable.

### M08-S25 Player accessibility (Must)
As a viewer who uses a screen reader or keyboard, I want the player to be fully operable, so that I can watch.
- AC1: Given a screen reader, When I focus a control, Then it announces its name, role and state ("Play, button", "Captions, on").
- AC2: Given state changes (buffering, error, up next), When they occur, Then a polite live region announces them.
- AC3: Given Tab order, When I tab, Then it flows play, seek, time, volume, captions, speed, quality, full screen with a visible focus ring.
- AC4: Given reduced motion, When on, Then control fades and autoplay countdown animation are minimised.
- Edge: seek bar is a slider with `aria-valuetext` like "2 minutes 14 seconds of 6 minutes".
- Error: not applicable.
- Empty: not applicable.

### M08-S26 Watch page layout (Must)
As a viewer, I want a clean watch page with the video first, so that I can focus.
- AC1: Given a desktop, When the page loads, Then a dark player area sits on the off-white page with title and description below, and pastel Up next tiles to the right (or below on narrow widths).
- AC2: Given a phone in portrait, When it loads, Then the player is full width at 16:9 at the top, with title, actions (My List, Share) and Up next below, and the page scrolls.
- AC3: Given a phone in landscape, When it loads, Then the player fills the screen and the rest is hidden until scroll.
- Edge: layout shift is avoided by reserving the 16:9 box.
- Error: not applicable.
- Empty: with no Up next items, the right column is hidden.

### M08-S27 Poster and first frame (Should)
As a viewer, I want to see the poster while the video starts, so that the screen is never blank.
- AC1: Given the player loads, When no frame is ready, Then the poster shows with a Play icon and a spinner only after 500 ms of waiting.
- AC2: Given the first frame renders, When ready, Then the poster fades out within 200 ms.
- Edge: the poster size matches the viewport (responsive image).
- Error: poster failure shows a dark neutral box.
- Empty: not applicable.

### M08-S28 End screen (Must)
As a viewer, I want a useful screen after the video ends, so that I know what to do next.
- AC1: Given a standalone title ends, When the end screen shows, Then I see Replay, Add to My List, and a related row, with the finished state saved.
- AC2: Given the last episode of a series ends, When it shows, Then it says "You finished <series>" with related series.
- Edge: leaving the end screen within 2 seconds still counts as finished.
- Error: not applicable.
- Empty: not applicable.

### M08-S29 Seek preview thumbnails (Could)
As a viewer, I want a preview image when I hover or drag the seek bar, so that I can find a moment.
- AC1: Given a sprite sheet exists, When I hover or drag, Then the image for that time shows above the bar.
- AC2: Given Data saver is on, When playing, Then the sprite is not downloaded.
- Edge: videos without a sprite show only the time tooltip.
- Error: sprite failure is silent.
- Empty: not applicable.

### M08-S30 Player quality metrics (Should)
As the developer, I want the player to report startup and stalls, so that I can see real viewer experience.
- AC1: Given a playback session, When it ends or every 60 seconds, Then the client sends startup time, rebuffer count and duration, average bitrate, errors, and device class (no personal data).
- AC2: Given the beacon fails, When offline, Then it is dropped (metrics are best effort).
- Edge: metrics are sampled at 100 percent at launch scale.
- Error: not applicable.
- Empty: not applicable.

### M08-S31 Resume across devices (Should)
As a viewer, I want to start on my phone and continue on my laptop, so that I can switch devices.
- AC1: Given I watched to 3:10 on phone, When I open the video on laptop in the same profile, Then playback starts from 3:07.
- AC2: Given both devices play at once, When writes conflict, Then the later server timestamp wins (see M09-S06).
- Edge: a sync delay up to 15 seconds is acceptable.
- Edge: Guests do not get this: their progress stays on the device. Signing in syncs it, and M40-S13 moves device progress into the account.
- Error: not applicable.
- Empty: not applicable.

---

## M09 Continue Watching

### M09-S01 Continue Watching row (Must)
As a viewer, I want a row of videos I have started, so that I can resume with one tap.
- AC1: Given I have unfinished videos with a position of 5 seconds or more, When I open Home, Then Continue Watching lists them most recent first with a progress bar.
- AC2: Given I tap a card, When pressed, Then the watch page opens and resumes at saved position minus 3 seconds.
- AC3: Given the row has more than 20 items, When I view it, Then the oldest are dropped from the row (history is kept).
- Edge: the row is per profile.
- Error: load failure hides the row and leaves the rest of Home.
- Empty: the row is not shown when empty.

### M09-S02 Start threshold (Must)
As a viewer, I want a brief accidental play not to clutter my row, so that the row only shows real progress.
- AC1: Given I watched fewer than 5 seconds, When I leave, Then no Continue Watching entry is created and any existing entry is left unchanged.
- AC2: Given I reach 5 seconds or more, When progress is saved, Then the entry is created.
- Edge: scrubbing to 6 seconds without watching still counts (position based).
- Error: not applicable.
- Empty: not applicable.

### M09-S03 Finish threshold (Must)
As a viewer, I want finished videos to leave the row, so that I only see what I have not completed.
- AC1: Given the position reaches 95 percent of duration or 10 seconds or fewer remain (whichever comes first), When progress is saved, Then `finished_at` is set, the position resets to 0 and the title leaves Continue Watching.
- AC2: Given a very short video (under 40 seconds), When 10 seconds remain, Then the rule still applies (95 percent or last 10 seconds).
- AC3: Given I seek back from the finished zone, When I resume a finished video, Then it counts as a new watch and the entry returns only if progress passes the start threshold again and I leave before the finish zone.
- Edge: reaching the credits at 94 percent and leaving keeps the entry; this is accepted.
- Error: duration unknown (live or bad metadata) never marks finished by percent; only by `ended` event.
- Empty: not applicable.

### M09-S04 Rewind on resume (Must)
As a viewer, I want a short rewind when resuming, so that I regain context.
- AC1: Given saved position P of 5 seconds or more, When I resume, Then playback begins at max(0, P minus 3).
- AC2: Given rewind is configured to 0 in site config, When resuming, Then it starts at P.
- Edge: with `?t=` in the URL, no rewind is applied.
- Error: not applicable.
- Empty: not applicable.

### M09-S05 Series next episode logic (Must)
As a viewer, I want a finished episode to be replaced by the next one, so that I continue the series.
- AC1: Given I finish episode 3 of a series with 6 episodes, When progress is saved, Then Continue Watching shows episode 4 at position 0 with the label "Next: E4". The card shows the "Next: E4" badge and the episode label (M44-S23).
- AC2: Given I finish the last episode, When saved, Then the series leaves Continue Watching.
- AC3: Given I am part way through episode 2 and episode 4 earlier, When the row renders, Then only one card per series shows: the most recently watched unfinished episode, or the next episode if the last one finished.
- Edge: if the next episode is not published, the series leaves the row.
- Error: not applicable.
- Empty: not applicable.

### M09-S06 Conflicting writes from two devices (Should)
As a viewer using two devices, I want a sane result, so that I do not lose place.
- AC1: Given two writes for the same profile and video arrive, When processing, Then the later client timestamp (validated within a 5 minute skew of the server time) wins.
- AC2: Given a write moves the position backwards by more than 30 seconds without a seek flag within 5 seconds of a forward write from another device, When received, Then it is ignored.
- Edge: a finish event always wins over positions.
- Error: invalid timestamps are replaced by server time.
- Empty: not applicable.

### M09-S07 Remove from Continue Watching (Should)
As a viewer, I want to remove an item from the row, so that I can tidy it.
- AC1: Given a card, When I open its kebab menu and choose "Remove from row", Then it disappears at once (optimistic) with an Undo toast for 6 seconds.
- AC2: Given I removed it, When I open the title, Then my position is cleared (it starts at 0).
- Edge: kids profiles can remove but only inside their own profile.
- Error: failure restores the card with an error toast.
- Empty: not applicable.

### M09-S08 Continue Watching expiry (Could)
As a viewer, I want old unfinished items to drop off, so that the row stays relevant.
- AC1: Given an entry not updated for 60 days, When the row loads, Then it is not shown (history retained).
- AC2: Given the period is changed in config, When saved, Then it applies to all profiles.
- Edge: opening the title directly still resumes if a position exists.
- Error: not applicable.
- Empty: not applicable.

### M09-S09 Watched indicators (Should)
As a viewer, I want to see which episodes I finished, so that I can pick up a series.
- AC1: Given an episode is finished, When I view the series page, Then it shows a tick and "Watched".
- AC2: Given an episode is partly watched, When shown, Then a progress bar shows.
- Edge: standalone title cards show a small tick when finished.
- Error: not applicable.
- Empty: not applicable.

### M09-S10 New profile has empty history (Must)
As a viewer who just made a profile, I want a clean start, so that nothing from other profiles appears.
- AC1: Given a new profile, When I open Home, Then no Continue Watching and no My List rows appear.
- AC2: Given I watch 10 seconds of a video, When I return to Home, Then Continue Watching appears.
- Edge: deleting a profile deletes its history.
- Error: not applicable.
- Empty: this is the empty state.

---

## M10 My List

### M10-S01 Add to My List (Must)
As a viewer, I want to save a title for later, so that I can find it again.
- AC1: Given a title card, detail page or watch page, When I tap the plus button, Then it is added at once, the icon changes to a tick with accessible state "In My List", and a toast "Added to My List" shows.
- AC2: Given the server rejects the add, When it fails, Then the icon reverts and a persistent error toast shows.
- AC3: Given I am offline, When I tap, Then the change is queued and applied on reconnect with a "Saved on this device" note.
- AC4: Given I am a guest, When I tap the plus button, Then the Sign in to save dialog opens and nothing is stored (M40-S07).
- Edge: adding the same title twice is idempotent.
- Error: limit of 500 items per profile; beyond it shows "My List is full".
- Empty: not applicable.

### M10-S02 Remove from My List (Must)
As a viewer, I want to remove a saved title, so that the list stays tidy.
- AC1: Given an item in My List, When I tap the tick or Remove, Then it disappears at once with an Undo toast for 6 seconds.
- AC2: Given I tap Undo, When within the window, Then it returns at its original position.
- Edge: removal from the card on Home also removes it from the page.
- Error: failure restores with an error toast.
- Empty: not applicable.

### M10-S03 My List page (Must)
As a viewer, I want a page listing everything I saved, so that I can choose.
- AC1: Given I open `/my-list`, When it loads, Then items show as a grid, newest added first by default, with card details, and filter and sort controls (M44-S24).
- AC2: Given a title is later unpublished, When I open the list, Then it is hidden but remains stored and returns if republished.
- AC3: Given many items, When scrolling, Then items load in pages of 24 with Show more.
- Edge: kids profile sees only kid titles.
- Edge: guests see an explainer instead of a list (M40-S08).
- Error: load failure shows retry.
- Empty: "Your list is empty. Tap + on any video to save it here" with a Browse button.

### M10-S04 My List row on Home (Should)
As a viewer, I want my list on Home, so that I can reach it fast.
- AC1: Given I have at least one item, When Home loads, Then a My List row shows the latest 20 and a See all card.
- AC2: Given the list is empty, When Home loads, Then the row is not rendered.
- Edge: row updates immediately when I add an item and return to Home.
- Error: ignored silently, with the rest of Home unaffected.
- Empty: see AC2.

### M10-S05 My List for series (Should)
As a viewer, I want to save a whole series, so that I follow it.
- AC1: Given a series page, When I tap My List, Then the series is saved (not individual episodes).
- AC2: Given I open the saved series, When I tap it, Then it opens the series page.
- Edge: adding an individual standalone video and a series are both supported.
- Error: not applicable.
- Empty: not applicable.

### M10-S06 My List consistency across devices (Should)
As a viewer, I want my list the same everywhere, so that I trust it.
- AC1: Given I add on phone, When I open the laptop within 15 seconds of refresh, Then it appears.
- AC2: Given simultaneous changes, When both arrive, Then the latest action per title wins.
- Edge: per profile.
- Error: not applicable.
- Empty: not applicable.

---

## M11 Captions (viewer side)

### M11-S01 Load approved captions only (Must)
As a viewer, I want captions I can trust, so that I am not shown wrong text.
- AC1: Given a video has tracks `approved` and `needs_review`, When the player loads, Then only the approved track is attached.
- AC2: Given a track is later set back to `rejected`, When the next playback starts, Then it is not served.
- AC3: Given captions files are requested, When served, Then they come from a signed URL with the same access rules as video.
- AC4: Given a track is approved but its Publish switch is off, or its language is removed from the site's caption languages, When the player loads, Then the track is not attached and not listed.
- Edge: caption files are cached by the CDN with a version suffix, so approved edits show quickly.
- Error: if the file fails, playback continues with an informative toast.
- Empty: no tracks means no CC button.

### M11-S02 Caption toggle and persistence (Must)
As a viewer, I want my caption choice remembered, so that I do not set it each time.
- AC1: Given I turn captions on, When I play another video, Then they are on.
- AC2: Given I turn them off, When I play another, Then they are off.
- Edge: first time default is off for adults and on for kids profiles.
- Error: not applicable.
- Empty: not applicable.

### M11-S03 Caption styling (Could)
As a viewer with low vision, I want to change caption size and background, so that I can read them.
- AC1: Given Caption settings, When I choose size (Small, Medium, Large, Extra large) and background (None, Dark, Solid), Then captions update live in a preview.
- AC2: Given high contrast presets, When chosen, Then colours meet 7 to 1 contrast.
- Edge: settings are per profile.
- Error: not applicable.
- Empty: not applicable.

### M11-S04 Caption language menu (Should)
As a viewer, I want to choose among caption languages, so that I read in my language.
- AC1: Given several approved and published tracks, When I open the menu, Then each language shows by its own name (Yorùbá, Igbo, Hausa, Naijá, English) with Off first.
- AC2: Given my profile caption language has a track, When the video loads, Then that track is chosen. Else the interface language if it has one, else English. Never the first track by position.
- AC3: Given a language track fails to load, When it fails, Then English is used and a toast says "That language could not load. Showing English."
- Edge: only approved and published tracks are listed; with only English there is a toggle and no menu; each row carries its own `lang` attribute.
- Error: no track at all hides the CC button.
- Empty: not applicable.

### M11-S05 Caption badge on titles (Should)
As a viewer, I want to see which titles have captions, so that I can pick one I can follow.
- AC1: Given a title has an approved track, When shown on a card or detail page, Then a small CC badge appears with a text alternative "Captions available".
- AC2: Given a series, When some episodes lack captions, Then the badge shows only for the episodes that have them.
- Edge: filter "With captions" in Browse (Could).
- Error: not applicable.
- Empty: not applicable.

### M11-S06 Captions positioning and legibility (Must)
As a viewer, I want captions readable on any background, so that I can follow.
- AC1: Given captions show, When rendered, Then they use a semi-opaque dark background, white text, a minimum 16 px size on mobile, and stay above the control bar.
- AC2: Given portrait mobile, When captions show, Then lines wrap to the video width and at most 2 lines show.
- Edge: cues longer than 42 characters per line are reflowed at the authoring step (M15), not at runtime.
- Error: not applicable.
- Empty: not applicable.

### M11-S07 Captions with speed and seeking (Must)
As a viewer, I want captions in sync, so that they match what I hear.
- AC1: Given speed is 1.5x, When captions run, Then they follow the media clock.
- AC2: Given I seek, When the new position loads, Then the current cue appears within 200 ms.
- Edge: a negative or overlapping cue is handled by the browser, and flagged during review (M15).
- Error: not applicable.
- Empty: not applicable.

---
## M12 Admin auth and roles

Role summary used in these stories: **Super admin** (ARKDEV): everything. **Admin** (Sister Vanessa): content, captions, curation, theme, publishing, users overview (read, safe support actions), analytics. **Editor**: videos, captions, curation (no theme, no users, no site settings, no publish override). **Analyst**: read only analytics and lists.

### M12-S01 Admin sign in (Must)
As an admin, I want a separate, stricter sign in at `/admin/login`, so that the back office is protected.
- AC1: Given an account with an admin role, When I enter valid email and password, Then I am asked for my 6 digit authenticator code before the session starts.
- AC2: Given an account without an admin role, When it signs in here, Then it sees the same generic "Email or password is incorrect" and no session is created.
- AC3: Given 3 failed attempts in 15 minutes, When another is made, Then the admin account is locked for 30 minutes and the Super admin is notified by email.
- AC4: Given a successful sign in, When the session starts, Then it lasts 8 hours absolute with a 30 minute idle timeout and shows a warning 2 minutes before expiry.
- Edge: viewer sessions are separate from admin sessions (a viewer signing in does not grant admin).
- Error: network failure keeps the form and offers retry.
- Empty: not applicable.

### M12-S02 Two factor authentication enrolment (Must)
As an admin, I want to set up an authenticator app, so that a stolen password is not enough.
- AC1: Given my first admin sign in, When I reach enrolment, Then I see a QR code and a manual key, and must enter a valid code to complete.
- AC2: Given enrolment completes, When shown, Then 10 single use recovery codes display once with Copy and Download, and I must confirm I saved them.
- AC3: Given I lose my device, When I use a recovery code, Then it works once and is then crossed off.
- Edge: authenticator codes allow 1 step clock drift.
- Error: wrong code shows "That code is not right", 5 wrong codes lock for 15 minutes.
- Empty: not applicable.

### M12-S03 Reset an admin's 2FA (Should)
As a Super admin, I want to reset another admin's 2FA, so that a lost phone does not lock them out.
- AC1: Given I open an admin in Roles, When I choose Reset 2FA and confirm with my own code, Then their 2FA is cleared, their sessions end and they must re-enrol at next sign in.
- AC2: Given the reset happens, When it completes, Then an audit entry is written and the admin is emailed.
- Edge: a Super admin cannot reset their own 2FA this way (uses recovery codes).
- Error: not applicable.
- Empty: not applicable.

### M12-S04 Role based access (Must)
As the owner, I want each role limited to what it needs, so that mistakes and abuse are limited.
- AC1: Given the permission matrix, When an Editor opens `/admin/theme`, Then they see a "You do not have access" screen and the menu item is hidden.
- AC2: Given an Analyst, When they call a write endpoint directly, Then the server returns 403 and logs it.
- AC3: Given the permission matrix is defined in one place, When a new action is added, Then a test fails until it has an explicit role mapping.
- Edge: permissions are checked on the server for every action and again in the UI only for display.
- Error: unknown role defaults to no access.
- Empty: not applicable.
- Edge: the matrix includes caption.availability, caption.approve_bulk, series.delete, users.bulk and roles.bulk (M42).

### M12-S05 Invite an admin user (Must)
As a Super admin, I want to invite someone by email with a role, so that they can help manage the platform.
- AC1: Given I enter an email and choose a role, When I send, Then an invite email with a link valid for 72 hours is sent.
- AC2: Given the invitee opens the link, When they set a password and enrol 2FA, Then the account gets the role and the invite is consumed.
- AC3: Given I revoke an unused invite, When confirmed, Then the link stops working.
- Edge: inviting an existing viewer email grants the role on that account after they confirm.
- Error: invalid or expired invite shows a clear message and asks the Super admin to resend.
- Empty: the invites list shows "No pending invites".

### M12-S06 Change or remove a role (Must)
As a Super admin, I want to change someone's role or remove access, so that access matches responsibility.
- AC1: Given I change a role and confirm, When saved, Then permissions apply on the user's next request and the change is audited with old and new role.
- AC2: Given I remove admin access, When confirmed, Then the user's admin sessions end at once.
- AC3: Given the last Super admin, When I try to demote or remove them, Then it is blocked with "There must be at least one Super admin".
- Edge: an admin cannot change their own role.
- Error: concurrent changes show a conflict message.
- Empty: not applicable.

### M12-S07 Roles screen (Must)
As a Super admin, I want one screen listing admins and the permission matrix, so that I can see who can do what.
- AC1: Given I open `/admin/roles`, When it loads, Then I see admins with role, last sign in, 2FA state, and the read only matrix of permissions by role.
- AC2: Given a non Super admin, When they open the URL, Then they get the no access screen.
- Edge: the matrix explains each permission in plain language.
- Error: load failure shows retry.
- Empty: only the Super admin listed.

### M12-S08 Admin session timeout (Must)
As the owner, I want idle admin sessions to end, so that an unattended laptop is not a risk.
- AC1: Given 30 minutes of no activity, When it passes, Then the next action redirects to login with a message and my unsaved form is kept in memory for restoring after login (Should).
- AC2: Given a long upload is running, When it runs, Then upload activity counts as activity so the session stays open, and uploads continue with their own presigned authority.
- Edge: absolute lifetime of 8 hours ends the session even while active, with a 2 minute warning.
- Error: not applicable.
- Empty: not applicable.

### M12-S09 My admin account (Should)
As an admin, I want a page for my own password and 2FA, so that I can manage my security.
- AC1: Given `/admin/account`, When I change my password with current password and 2FA code, Then it changes and my other sessions end.
- AC2: Given I regenerate recovery codes, When confirmed with my 2FA code, Then old codes stop working.
- Edge: shows my active admin sessions with Revoke.
- Error: wrong code or password counts toward the admin lockout.
- Empty: not applicable.

---

## M13 Upload

### M13-S01 Open the upload screen (Must)
As an admin, I want a clear place to add videos, so that I know how to start.
- AC1: Given I open `/admin/videos/upload`, When it loads, Then I see a large drop zone with "Drop videos here or choose files", accepted types (MP4, MOV, MKV, WebM) and the 5 GB limit.
- AC2: Given an Analyst role, When they open it, Then they get the no access screen.
- Edge: on mobile the drop zone becomes a Choose files button.
- Error: load failure shows retry.
- Empty: the queue area shows "No uploads yet".

### M13-S02 Drag and drop feedback (Must)
As an admin, I want the screen to react when I drag a file over it, so that I know it will accept the drop.
- AC1: Given I drag a file over the zone, When over it, Then the border changes, a tint overlay glows and the text changes from "Drop your file" to "Release to upload" simultaneously.
- AC2: Given I drag away, When leaving, Then the zone returns to normal.
- AC3: Given I drop an unsupported file, When released, Then it is not queued and a clear inline message says which file and why.
- Edge: dropping a folder queues the supported files inside it (where the browser allows).
- Error: not applicable.
- Empty: not applicable.

### M13-S03 Multi-file independent queue (Must)
As an admin, I want to add many files at once, so that I can load the launch library in a few sessions.
- AC1: Given I add 20 files, When queued, Then each shows as its own row with name, size, status and progress, and by default 2 files upload at once, the rest are "Waiting".
- AC2: Given one file fails, When it errors, Then the others continue unaffected.
- AC3: Given I use Pause all or Pause on a row, When paused, Then in-flight parts finish and the file keeps its progress.
- AC4: Given I change the parallel files setting (1 to 4), When saved, Then the queue adapts.
- Edge: reordering the queue by drag is allowed (Could).
- Error: per file errors are shown in the row, not as a global modal.
- Empty: see M13-S01.

### M13-S04 Honest progress (Must)
As an admin, I want exact progress, so that I can decide whether to wait.
- AC1: Given an upload runs, When it progresses, Then the row shows percentage, uploaded and total size, transfer speed (for example 2.4 MB/s) and time left (ETA), updated at least once a second, with a smoothed estimate.
- AC2: Given progress changes, When the bar updates, Then it animates `width` over 300 ms ease-out.
- AC3: Given speed drops to near zero, When 15 seconds pass, Then the row shows "Connection is slow or lost. Still trying" rather than an infinite spinner.
- Edge: the browser tab title shows overall percentage while uploading.
- Error: not applicable.
- Empty: not applicable.

### M13-S05 Resumable multipart upload (Must)
As an admin on a poor connection, I want uploads to resume where they stopped, so that I never restart from zero.
- AC1: Given a 1 GB file, When uploading, Then it is split into 8 MB parts, 3 in parallel, each part uses a presigned URL and its ETag is recorded.
- AC2: Given the network drops at 90 percent, When it returns, Then the upload resumes from the first missing part, not from 0.
- AC3: Given I reload the page or close the browser, When I return and re-select the same file, Then the app matches it (name, size, modified time, first MB hash) to the stored upload id and offers "Resume from 90 percent".
- AC4: Given presigned URLs expire after 1 hour, When a part URL expires, Then a fresh one is requested automatically.
- Edge: the laptop sleeping mid upload resumes when it wakes.
- Error: a part fails 5 times with backoff, then the row shows "Upload failed at 90 percent" with Retry.
- Empty: not applicable.

### M13-S06 Inline retry (Must)
As an admin, I want a Retry button on the failed row, so that I can recover without redoing others.
- AC1: Given a failed row, When I tap Retry, Then the upload resumes from the failed part and the row shows the progress.
- AC2: Given retry fails again, When it does, Then the error message explains the likely cause (offline, file changed on disk, URL expired) in plain words.
- AC3: Given the source file was moved or edited, When I retry, Then I am asked to re-select it and the app checks that it matches.
- Edge: Retry all failed button for the batch.
- Error: see AC2.
- Empty: not applicable.

### M13-S07 File validation (Must)
As an admin, I want bad files rejected early, so that I do not wait for a failed encode.
- AC1: Given a file over 5 GB, When added, Then it is rejected before upload with the limit shown.
- AC2: Given a file with a wrong extension or MIME type, When added, Then it is rejected.
- AC3: Given the file uploaded, When the server probes it, Then a file with no video stream, zero duration or an unreadable container is marked "Could not read this file" with Replace.
- AC4: Given a video longer than 60 minutes, When probed, Then a warning shows (platform is built for short videos) but it is allowed.
- Edge: same name and size as an existing source triggers a duplicate warning with options Upload anyway or Skip.
- Error: see AC3.
- Empty: not applicable.

### M13-S08 Upload completion preview card (Must)
As an admin, I want a card when the upload finishes, so that I can confirm it is the right file.
- AC1: Given an upload completes, When finished, Then the row becomes a card with a thumbnail (first frame or a generated frame once available, else a video icon), file type and exact size, duration, a badge "Uploaded just now", and the encoding status.
- AC2: Given the card, When I tap Replace, Then I can choose another file and the previous source is removed after the new one completes.
- AC3: Given the card, When I tap Remove, Then I confirm and the draft record and uploaded source are deleted.
- Edge: the card has an Edit details link that opens Video edit.
- Error: thumbnail generation failure shows the icon and does not block.
- Empty: not applicable.

### M13-S09 Create draft on upload (Must)
As an admin, I want each upload to become a draft video automatically, so that nothing goes live by accident.
- AC1: Given an upload completes, When the server verifies the parts, Then a draft video is created with title from the filename (cleaned), status `processing`, suitability `general`, and an encoding job is queued.
- AC2: Given the completion request is retried, When duplicated, Then it is idempotent (one video, one job).
- AC3: Given the draft exists, When I open the Videos list, Then it appears with a Draft badge.
- Edge: title cleaning replaces underscores, removes extension and trims.
- Error: if verification finds a missing part, the upload returns to the failed state and resumes.
- Empty: not applicable.

### M13-S10 Leave the page safely (Should)
As an admin, I want a warning before I leave during an upload, so that I do not lose work by accident.
- AC1: Given uploads are active, When I try to close the tab or navigate away, Then a browser confirmation appears.
- AC2: Given I confirm leaving, When I return, Then unfinished uploads show as "Paused. Re-select the file to resume".
- AC3: Given I navigate inside `/admin` (single page), When switching sections, Then uploads continue in the background and a small global progress chip stays visible.
- Edge: the chip links back to the upload screen.
- Error: not applicable.
- Empty: not applicable.

### M13-S11 Cancel and clean up (Should)
As an admin, I want to cancel an upload, so that unwanted files are not stored.
- AC1: Given an active upload, When I tap Cancel and confirm, Then the multipart upload is aborted and parts removed from R2.
- AC2: Given an abandoned multipart upload older than 7 days, When the cleanup job runs, Then it is aborted and its parts deleted.
- Edge: cancelled rows remain visible briefly with Undo only before abort.
- Error: abort failure is retried by the job and alerts if it fails 3 times.
- Empty: not applicable.

### M13-S12 Upload from a phone (Could)
As an admin on a phone, I want to upload a video from my gallery, so that I can add content away from my laptop.
- AC1: Given a phone, When I choose a file from the gallery, Then upload works with the same resumable logic and keeps running while the screen is on.
- AC2: Given the app is in the background, When the browser suspends, Then the upload pauses and resumes on return.
- Edge: a Wi-Fi only option warns before large uploads on mobile data.
- Error: same as desktop.
- Empty: not applicable.

---

## M14 Encoding worker

### M14-S01 Queue an encoding job (Must)
As the system, I want an encoding job created for each uploaded source, so that every video gets renditions.
- AC1: Given a draft video with a verified source, When created, Then a job is queued with status `queued` and the video status becomes `processing`.
- AC2: Given the same video is queued twice, When detected, Then only one active job exists.
- Edge: priority is first in first out, with manual bump (Could).
- Error: queue write failure rolls back the draft creation response with a retryable error.
- Empty: not applicable.

### M14-S02 Probe the source (Must)
As the system, I want to read the source's properties first, so that bad files fail early and the ladder is correct.
- AC1: Given a job starts, When ffprobe runs, Then duration, width, height, frame rate, codecs and audio presence are stored.
- AC2: Given a source with height 720, When planning the ladder, Then renditions are 360, 480, 720 only (no upscale).
- AC3: Given a source without audio, When planning, Then video only renditions are produced and flagged "No audio".
- Edge: portrait or odd dimensions are padded or scaled to even numbers.
- Error: probe failure marks the job failed with reason "Could not read file" and notifies the admin.
- Empty: not applicable.

### M14-S03 Encode HLS ladder (Must)
As the system, I want a four rung HLS ladder, so that every device and network can play.
- AC1: Given a 1080p source, When encoded, Then outputs are 360p (about 400 kbps total), 480p (about 800 kbps), 720p (about 1.8 Mbps) and 1080p (about 3.5 Mbps), H.264 and AAC, 6 second segments with keyframes aligned, and a master playlist.
- AC2: Given the ladder, When completed, Then all rungs have the same segment boundaries so ABR can switch cleanly.
- AC3: Given audio, When encoded, Then loudness is normalised to a consistent level (EBU R128 target) so videos play at similar volume.
- Edge: bitrates and rungs are configuration, not constants in code.
- Error: an encode failure on one rung retries that rung, not the whole job.
- Empty: not applicable.

### M14-S04 Encrypt segments (Must)
As the owner, I want HLS encryption, so that segment files cannot be played without a key.
- AC1: Given encoding, When packaging, Then each video gets its own AES-128 key stored encrypted at rest, playlists reference the key endpoint, and segments are encrypted.
- AC2: Given a key rotation request, When run, Then new videos use a new key and old keys stay valid for existing videos.
- Edge: the key URI is relative to the app domain, not the CDN.
- Error: key generation failure stops the job (never publishes unencrypted).
- Empty: not applicable.

### M14-S05 Progress and stages (Must)
As an admin, I want to see what the worker is doing, so that I trust it is working.
- AC1: Given a running job, When it advances, Then stage (Queued, Reading file, Encoding 360p, Encoding 480p, Encoding 720p, Encoding 1080p, Packaging, Uploading, Done) and percent update at least every 5 seconds.
- AC2: Given the job finishes, When done, Then the video becomes `ready` and the admin sees a notice.
- Edge: ETA is shown after 10 percent progress.
- Error: stalled jobs (no heartbeat for 5 minutes) are flagged "Stalled" and re-queued.
- Empty: not applicable.

### M14-S06 Failure, retry and backoff (Must)
As an admin, I want failures handled and explained, so that I know what to do.
- AC1: Given a job fails, When it does, Then it retries up to 3 times with backoff (1, 5, 15 minutes) and then becomes `failed`.
- AC2: Given a failed job, When I open it, Then I see a plain reason ("The video file is damaged. Try exporting it again") and a technical detail section for the developer, and Retry and Replace file buttons.
- AC3: Given Retry, When pressed, Then the job restarts from the last good stage.
- Edge: out of disk or CPU limit errors alert the developer, not only the admin.
- Error: never show raw stack traces to admins.
- Empty: not applicable.

### M14-S07 Resource limits on the VPS (Should)
As the developer, I want encoding not to starve the website, so that viewers are unaffected.
- AC1: Given an encode runs, When CPU is high, Then the worker runs at lower priority and concurrency is 1 by default.
- AC2: Given disk free space falls below 15 percent, When a job is about to start, Then it waits and alerts.
- Edge: working files are removed after each job, even on failure.
- Error: cleanup failure is logged and retried.
- Empty: not applicable.

### M14-S08 Publish renditions to R2 (Must)
As the system, I want renditions uploaded to R2 in a predictable layout, so that the CDN can serve them.
- AC1: Given encoding done, When uploading, Then files go to `hls/<videoId>/<rendition>/` and `hls/<videoId>/master.m3u8`, with correct content types and cache headers (segments immutable, playlists short).
- AC2: Given upload interrupted, When the job resumes, Then already uploaded objects are verified and skipped.
- Edge: the source stays under `sources/` until the video is deleted.
- Error: a verification mismatch re-uploads the object.
- Empty: not applicable.

### M14-S09 Encoding queue screen (Must)
As an admin, I want one screen showing every encoding job, so that I can see what is waiting, running or failed.
- AC1: Given `/admin/encoding`, When it loads, Then jobs list with video title, stage, percent, ETA, started time and status (Queued, Running, Done, Failed, Stalled), updating live (polling every 5 seconds, or server sent events) without a full reload.
- AC2: Given a failed job, When I open its row, Then I see the plain language reason and Retry and Replace file buttons (see M14-S06).
- AC3: Given filters (status, date), When I change them, Then the list updates and the filter is in the URL.
- AC4: Given an Editor, When they open it, Then they see jobs and can Retry but not change worker settings.
- Edge: a job that finishes while I watch moves to Done with a subtle highlight, no jump in layout.
- Error: if live updates fail, a banner says "Live updates paused" and manual Refresh remains.
- Empty: "No encoding jobs. Upload a video to begin".

---

## M15 Caption pipeline and review

### M15-S01 Auto generate captions in the spoken language (Must)
As an admin, I want captions generated automatically, so that I only have to review them.
- AC1: Given encoding has produced audio, When the caption job runs, Then faster-whisper creates a WebVTT track in the video's spoken language (English, Yoruba or Hausa on a server with the multilingual model, M46-S15) with word level timing, and the track state becomes `needs_review`.
- AC2: Given generation finishes, When done, Then an admin notification "Captions ready to review" appears (and an email if enabled).
- AC3: Given silence or music only, When no speech is found, Then the track is `needs_review` with a note "No speech detected".
- AC4: Given the spoken language is Igbo, When I open Captions, Then generation is not offered and the page says to upload a caption file.
- Edge: cues are reflowed to at most 2 lines of 42 characters and 1 to 7 seconds long.
- Error: failure marks the track `generating_failed` with Retry.
- Empty: not applicable.

### M15-S02 Align an existing script (Should)
As an admin who has the script, I want captions aligned to it, so that wording is exact.
- AC1: Given I upload a plain text script on the video, When I run Align, Then timings are computed against the audio and the text from my script is used.
- AC2: Given alignment confidence is low in places, When done, Then those cues are highlighted for review.
- Edge: scripts with speaker names or stage directions are cleaned by a simple rule with a preview.
- Error: very different script and audio shows "The script does not match the audio" and offers free recognition.
- Empty: not applicable.

### M15-S03 Caption review list (Must)
As an admin, I want to see which videos need caption review, so that none slip through.
- AC1: Given `/admin/captions`, When it loads, Then videos are listed with caption state, language, cue count, and last edited, filterable by state. A language chip per translation shows its state, and the list filters by language and by state.
- AC2: Given I tap a row, When opened, Then the review screen opens.
- AC3: Given the nav badge, When videos need review, Then it shows the count.
- Edge: sorted by oldest waiting first.
- Error: load failure shows retry.
- Empty: "No captions waiting. Nice work."
- AC4: Given the list, When I select tracks, Then I can bulk approve eligible ones (Admin role), filter by 'never edited', and see the Cues column right aligned over its values (M42-S01, M42-S08).

### M15-S04 Review screen layout (Must)
As an admin, I want to watch the video and read the captions side by side, so that I can check accuracy.
- AC1: Given the review screen, When it loads, Then the video (with caption overlay) sits at the top or left, the cue list sits beside or below, and the current cue is highlighted and scrolls into view.
- AC2: Given I click a cue, When clicked, Then the video seeks to its start.
- AC3: Given the review screen on a phone, When opened, Then the layout stacks vertically with a sticky video.
- Edge: playback speed control up to 2x for faster review.
- Error: video load failure shows an error but the cue list stays usable.
- Empty: not applicable.

### M15-S05 Edit cue text and timing (Must)
As an admin, I want to correct words and timing, so that captions are accurate.
- AC1: Given a cue, When I edit the text, Then it saves automatically after 1 second (draft) and a "Saved" indicator shows.
- AC2: Given timing fields (start and end), When I adjust them, Then values validate (end after start, no overlap with neighbours) with inline errors.
- AC3: Given Split and Merge actions, When used, Then cues split at the cursor or merge with the next, and timings are adjusted sensibly.
- AC4: Given I edit with the keyboard, When I press Ctrl and Enter, Then it moves to the next cue and plays it (Could).
- Edge: undo and redo for the last 50 edits.
- Error: save failure shows a persistent warning and keeps local edits, with Retry.
- Empty: not applicable.

### M15-S06 Find and replace (Should)
As an admin, I want to fix a repeated mistake everywhere, so that I save time on names and terms.
- AC1: Given the find box, When I enter a word and a replacement, Then matches highlight and Replace all shows the count before applying.
- AC2: Given I apply it, When done, Then it is one undo step.
- Edge: match case option.
- Error: no matches shows "Nothing found".
- Empty: not applicable.

### M15-S07 Approve a caption track (Must)
As an admin, I want to approve a track, so that viewers can see it.
- AC1: Given a track in `needs_review`, When I press Approve and confirm, Then its state becomes `approved`, a version is stored, the VTT is published to R2 and the CDN, and an audit entry is written.
- AC2: Given the track has validation warnings (overlaps, empty cues, cues over 7 seconds), When I approve, Then I see the warnings and must confirm to continue.
- AC3: Given I edit an approved track, When I save, Then it returns to `needs_review` unless I choose "Save and keep approved" (Admin role only).
- Edge: approver name and time are shown on the track.
- Error: publish failure leaves the state unchanged and shows an error.
- Empty: not applicable.
- Edge: bulk approval skips tracks with validation warnings and asks for an acknowledgement when auto captions were never edited (M42-S08).

### M15-S08 Reject or regenerate (Should)
As an admin, I want to reject poor captions and try again, so that I can improve them.
- AC1: Given a track, When I choose Regenerate, Then a new job creates a fresh track and the old one is kept as a revision.
- AC2: Given I choose Reject with a note, When saved, Then the state becomes `rejected` and it is never shown to viewers.
- Edge: regenerating warns that manual edits will be replaced.
- Error: job failure keeps the previous track.
- Empty: not applicable.

### M15-S09 Upload or download a caption file (Should)
As an admin, I want to import or export a caption file, so that I can edit elsewhere.
- AC1: Given I choose Download, When pressed, Then a `.vtt` file downloads.
- AC2: Given I upload a `.vtt` or `.srt`, When processed, Then it is converted to WebVTT, validated and set to `needs_review`.
- Edge: files over 2 MB are rejected.
- Error: parse failure shows the line number and reason.
- Empty: not applicable.

### M15-S10 Caption gate before publish (Must)
As the owner, I want videos to need approved captions before going live, so that no viewer sees unreviewed text and every title has captions.
- AC1: Given a video without an approved track in its spoken language, When I try to publish, Then publish is blocked with "Approve captions first" and a link to the review screen.
- AC2: Given an Admin overrides with a reason, When confirmed, Then the video publishes without captions and the override is audited (setting `captions_required` can be turned off by Super admin).
- Edge: Editors cannot override. Translations never block publishing.
- Error: not applicable.
- Empty: not applicable.

### M15-S11 Caption translations (superseded)
Moved and expanded as M46-S11 to M46-S13 and M46-S16.

---

## M16 Content management (videos, series, categories)

### M16-S01 Videos list (Must)
As an admin, I want a searchable list of all videos, so that I can find and manage them.
- AC1: Given `/admin/videos`, When it loads, Then I see a table (cards on mobile) with thumbnail, title, status badge, duration, categories, captions state, published date, with search and filters (status, category, captions state, suitability).
- AC2: Given more than 25 rows, When paging, Then cursor pagination is used, page and filters are in the URL query string, and the scroll position is restored on return.
- AC3: Given I select rows, When I use bulk actions (publish, unpublish, set category, set suitability, delete), Then a confirmation shows the count and the action runs with a progress summary.
- AC4: Given a long running list load, When waiting over 300 ms, Then skeleton rows with matched geometry show.
- Edge: status badges use colour plus text (not colour alone).
- Error: load failure shows retry inside the table area.
- Empty: "No videos yet. Upload your first video" with a button.

### M16-S02 Edit video details (Must)
As an admin, I want to edit a video's information, so that viewers see good titles and descriptions.
- AC1: Given `/admin/videos/<id>`, When I edit title (3 to 100 chars), description (up to 1000 chars), categories, tags, suitability, and poster, Then changes save on pressing Save with a clear "Saved" confirmation and an audit entry with before and after.
- AC2: Given I leave with unsaved changes, When I navigate, Then I am asked to save or discard.
- AC3: Given validation is lazy then eager, When I blur a field, Then errors show with `aria-describedby`.
- AC4: Given a live preview card, When I type, Then the card preview updates beside the form (how it looks on Home).
- Edge: character counters; descriptions trimmed.
- Error: save failure keeps the form and shows a persistent error toast.
- Empty: not applicable.

### M16-S03 Choose or upload a poster (Must)
As an admin, I want to choose the poster image, so that titles look right.
- AC1: Given generated candidates (6 frames), When I select one, Then it becomes the poster and responsive sizes are generated.
- AC2: Given I upload my own image (JPG, PNG, WebP, up to 5 MB, at least 1280 by 720), When processed, Then crops for card and hero are created and I can adjust the focus point.
- AC3: Given the image is too small, When uploaded, Then it is rejected with the minimum size.
- Edge: text safe area overlay is shown while cropping.
- Error: processing failure keeps the previous poster.
- Empty: not applicable.

### M16-S04 Create and edit a series (Must)
As an admin, I want to group videos into a series, so that viewers can follow them in order.
- AC1: Given `/admin/series`, When I create a series with title, description, poster and categories, Then it appears in the list as Draft.
- AC2: Given a series, When I add videos as episodes, Then I set season and episode number, with drag to reorder.
- AC3: Given I remove an episode, When confirmed, Then the video returns to standalone.
- Edge: a video can belong to one series only.
- Error: duplicate episode number blocks save with the field highlighted.
- Empty: "No series yet" with a Create series button.

### M16-S05 Manage categories (Must)
As an admin, I want to create and organise categories, so that browsing is clear.
- AC1: Given `/admin/categories`, When I add a category (name, slug auto), Then it appears and can be reordered by drag and by Up and Down buttons (keyboard).
- AC2: Given I rename a category, When saved, Then the slug stays unless I change it (old slug redirects).
- AC3: Given I delete a category in use, When confirmed, Then I choose another category to reassign, or remove it from titles.
- AC4: Given I hide a category, When saved, Then viewers do not see it.
- Edge: category names unique, 2 to 30 characters.
- Error: delete failure keeps the category.
- Empty: "No categories yet".

### M16-S06 Soft delete and undo (Should)
As an admin, I want deleted videos recoverable for a while, so that mistakes are not final.
- AC1: Given I delete a video, When confirmed, Then it moves to Trash for 30 days, is unpublished at once, and an Undo toast shows for 10 seconds.
- AC2: Given the Trash view, When I choose Restore, Then it returns as Draft.
- AC3: Given 30 days pass, When the cleanup job runs, Then renditions and source are deleted from R2 and the record is purged.
- Edge: an Admin or Super admin can Delete forever with a typed confirmation (the word delete for one video, the count for several, M42-S13).
- Error: R2 deletion failure retries and alerts.
- Empty: "Trash is empty".
- AC4: Given selected videos in Trash, When I choose Restore or Delete forever, Then it applies to all with a result per video (M42-S13).

### M16-S07 Video detail status panel (Must)
As an admin, I want one status panel per video, so that I see what is left to do.
- AC1: Given a video, When I open it, Then a checklist shows Uploaded, Encoded, Poster chosen, Captions approved, Details complete, Suitability set, each with state and a link to fix.
- AC2: Given all items are complete, When shown, then the Publish button becomes enabled.
- Edge: checklist items that block publish are marked "Required".
- Error: not applicable.
- Empty: not applicable.

### M16-S08 Preview as viewer (Should)
As an admin, I want to preview a draft as a viewer, so that I check it before it goes live.
- AC1: Given a draft or ready video, When I choose Preview, Then it opens the real watch page in preview mode with a banner "Preview. Not public" and uses a short lived preview token.
- AC2: Given the preview link is shared, When someone without admin sign in opens it, Then it fails.
- Edge: preview does not write watch progress or analytics.
- Error: not applicable.
- Empty: not applicable.

### M16-S09 Bulk edit (Should)
As an admin, I want to change many videos at once, so that large clean ups are quick.
- AC1: Given selected rows, When I choose Add category, Then it applies to all, with a summary of changes.
- AC2: Given an error on some items, When it completes, Then I see which failed and can retry them.
- Edge: bulk delete needs typing the count.
- Error: network failure reports partial result clearly.
- Empty: not applicable.

### M16-S10 Duplicate and replace source (Could)
As an admin, I want to replace the video file while keeping its details, so that I can fix a render.
- AC1: Given a video, When I choose Replace source and upload a new file, Then it re-encodes and keeps title, description, categories and views, and the old renditions are removed after the new ones are ready.
- AC2: Given captions exist, When the new source differs in length, Then captions are flagged "Needs review".
- Edge: progress for viewers is reset for that video (positions may no longer match) with the finished flag kept.
- Error: failure keeps the old version live.
- Empty: not applicable.

### M16-S11 Admin dashboard (Must)
As an admin, I want a dashboard when I sign in, so that I see what needs attention.
- AC1: Given `/admin`, When it loads, Then I see counts (published, drafts, processing, failed), "Needs attention" list (failed encodes, captions to review, scheduled today), recent uploads, storage used, and last 7 days views.
- AC2: Given an Editor, When it loads, Then it hides analytics and storage tiles.
- Edge: each tile links to the filtered list.
- Error: a tile failure shows retry only for that tile.
- Empty: new platform shows "Start here" with three steps (Upload, Review captions, Publish).

---

## M17 Home curation

### M17-S01 Choose hero titles (Must)
As an editor, I want to pick the featured title, so that Home highlights what matters.
- AC1: Given `/admin/home`, When I choose up to 5 published titles for the hero, Then they are saved with order and shown with rotation on Home (20 seconds by default).
- AC2: Given a hero title is unpublished, When viewers load Home, Then it is skipped automatically.
- Edge: each hero slot can override the headline, description and button label (80 chars), see M41-S16.
- Error: more than 5 shows a limit message.
- Empty: with none chosen, the 5 newest titles are used (the preview shows this).

### M17-S02 Create and order rows (Must)
As an editor, I want to build and reorder rows, so that Home tells the story I want.
- AC1: Given I add a row, When I choose a type (Manual list, Category, New, Trending, Series, Each category, All series) and a name, Then it appears in the list. Row types also include Trending now, Top 10 and Most liked (M44-S10).
- AC2: Given rows, When I drag one (or use Move up and Move down buttons), Then the order saves and the preview updates.
- AC3: Given I hide a row, When saved, Then it disappears from Home but is kept.
- AC4: Given a section, When I open its View all setting, Then I can choose Automatic, Custom link or None (M41-S08).
- Edge: maximum 12 rows to protect performance.
- Error: save failure keeps local order with retry.
- Empty: "No rows yet" with a Create row button.

### M17-S03 Manage titles in a manual row (Must)
As an editor, I want to add, remove and order titles in a row, so that I control it exactly.
- AC1: Given a manual row, When I search and add a title, Then it joins at the end and can be dragged or moved with keyboard buttons.
- AC2: Given I remove a title, When confirmed, Then it leaves the row (not deleted from the catalog).
- AC3: Given a title is later unpublished, When the row renders, Then it is skipped but kept in the editor with a warning icon.
- Edge: maximum 30 titles per row.
- Error: duplicates are blocked.
- Empty: "Add titles to this row".

### M17-S04 Live preview (Should)
As an editor, I want to see Home change as I edit, so that I know how it will look.
- AC1: Given the preview pane, When I change anything, Then the preview updates in under 1 second with a toggle for desktop and mobile widths.
- AC2: Given I have unsaved changes, When I look at the toolbar, Then it says "Unsaved changes" with Save and Discard.
- Edge: preview shows as an adult profile with a toggle for kids.
- Error: preview failure shows a message but editing continues.
- Empty: not applicable.

### M17-S05 Personal row positions (Should)
As an editor, I want to set where Continue Watching and My List sit, so that Home order is right.
- AC1: Given the row list, When I move these fixed rows, Then viewers see the new order (hidden when empty).
- Edge: these rows cannot be deleted, only hidden.
- Error: not applicable.
- Empty: not applicable.

### M17-S06 Smart rows (Could)
As an editor, I want rows that fill themselves, so that Home stays fresh with little work.
- AC1: Given a Newest row, When new titles publish, Then the row includes them automatically (limit 20).
- AC2: Given Trending now, When refreshed hourly, Then top titles by weighted plays of the last 7 Lagos days appear (M44-S07).
- Edge: tie break by newer publish date.
- Error: with fewer than 4 titles with views the row is hidden and does not repeat New (M41-S05). Popular may fall back to newest when ticked (M44-S08).
- Empty: not applicable.

### M17-S07 Publish curation changes (Should)
As an editor, I want to review before changes go live, so that mistakes do not reach viewers.
- AC1: Given I changed rows, When I press Publish changes, Then they go live and an audit entry records before and after.
- AC2: Given I want to revert, When I choose Restore previous, Then the last published layout returns.
- Edge: autosave keeps a draft layout separate from the live one.
- Error: failure keeps the live layout unchanged.
- Empty: not applicable.

---

## M28 Publishing and scheduling

### M28-S01 Publish now (Must)
As an admin, I want to publish a ready video, so that viewers can watch it.
- AC1: Given a video passes the checklist, When I press Publish and confirm, Then its status becomes `published`, `published_at` is set, caches are invalidated and it appears to viewers within 60 seconds.
- AC2: Given the checklist fails, When I try, Then Publish is disabled with reasons listed and links to fix.
- Edge: publishing a series episode makes the series visible if it was hidden.
- Error: failure leaves status unchanged with an error.
- Empty: not applicable.

### M28-S02 Schedule publication (Must)
As an admin, I want to schedule a release, so that content goes live when I choose.
- AC1: Given I pick a date and time (default zone Africa/Lagos, shown clearly), When I confirm, Then status becomes `scheduled` and the time is stored in UTC.
- AC2: Given the time arrives, When the scheduler runs (every minute), Then the video publishes within 2 minutes.
- AC3: Given a scheduled time in the past, When I try to save, Then it is rejected.
- Edge: scheduled items show a countdown in the list and on the dashboard.
- Error: scheduler outage is caught up on restart (overdue items publish at once, with an alert).
- Empty: not applicable.

### M28-S03 Unpublish and republish (Must)
As an admin, I want to hide a live video, so that I can fix a problem fast.
- AC1: Given a published video, When I choose Unpublish and confirm, Then it disappears for viewers within 60 seconds, playback tokens stop refreshing and an audit entry is written.
- AC2: Given an unpublished video, When I Republish, Then it returns with its original publish date retained.
- Edge: viewers' progress and lists are kept.
- Error: not applicable.
- Empty: not applicable.

### M28-S04 Cancel or change a schedule (Should)
As an admin, I want to change my mind about a scheduled release, so that plans can move.
- AC1: Given a scheduled video, When I change the time, Then the new time applies and the old schedule is replaced.
- AC2: Given I cancel the schedule, When confirmed, Then status returns to `ready`.
- Edge: changes within 2 minutes of the time warn that it may already be running.
- Error: not applicable.
- Empty: not applicable.

### M28-S05 Publish checklist gate (Must)
As the owner, I want the publish rules enforced on the server, so that no incomplete video goes live.
- AC1: Given a publish request, When any required item fails (encoding, poster, title, description, category, suitability, approved captions), Then the server returns 422 listing each missing item regardless of the UI.
- AC2: Given an Admin override for captions, When used, Then it requires a reason and is audited.
- Edge: checks are re-run by the scheduler at publish time (a scheduled video that lost its poster does not go live and alerts).
- Error: not applicable.
- Empty: not applicable.

### M28-S06 Series visibility rule (Should)
As the owner, I want a series to appear only when it has something to watch, so that empty series are not shown.
- AC1: Given a series, When all episodes are unpublished, Then it is hidden from viewers.
- AC2: Given the first episode publishes, When it goes live, Then the series appears.
- Edge: series publishing status can be set Draft by the admin even if episodes are published.
- Error: not applicable.
- Empty: not applicable.

---
## M18 Theme settings

### M18-S01 Edit colours (Must)
As an admin, I want to change the site colours, so that the look matches my brand.
- AC1: Given `/admin/theme`, When I open it, Then I see colour fields for background, ink, muted, border, banner and accent, showing current values (defaults `#F5F5F2`, `#1A1C22`, `#5B606B`, `#DEDDD6`, `#1F6FB5`, `#FFC93C`).
- AC2: Given I pick a colour (picker or hex), When valid, Then the preview updates at once without saving.
- AC3: Given an invalid hex, When I blur, Then an inline error shows and the preview keeps the last valid value.
- Edge: Hex accepts 3 or 6 digits with or without the hash.
- Error: save failure keeps edits locally with Retry.
- Empty: not applicable.

### M18-S02 Contrast warning (Must)
As an admin, I want a warning when colours are hard to read, so that viewers can read the site.
- AC1: Given a pair such as ink on background, When contrast is below 4.5 to 1 (3 to 1 for large text), Then a warning shows the ratio and which pair fails, with a suggested fix.
- AC2: Given warnings exist, When I save, Then I may continue after confirming (Admin) but the warning remains visible on the screen and in the audit entry.
- AC3: Given extreme failures (below 2 to 1), When I save, Then it is blocked.
- Edge: the banner colour is checked against white text, and accent against ink text.
- Error: not applicable.
- Empty: not applicable.

### M18-S03 Fonts from a curated list (Must)
As an admin, I want to choose fonts from a safe list, so that the site stays fast and readable.
- AC1: Given the font selectors (headings and body), When I open them, Then I see a curated list (for example 6 families) with a preview line each.
- AC2: Given a font is selected, When saved, Then it is self hosted (no third party font request) as WOFF2 subsets, with a system font fallback stack.
- AC3: Given the total font weight, When added up, Then it stays within a budget of 100 KB for the first load.
- Edge: no arbitrary font upload (keeps performance and licensing safe).
- Error: font file missing falls back to the system stack.
- Empty: not applicable.

### M18-S04 Sizes (Should)
As an admin, I want to adjust base text size and card radius, so that I can tune density.
- AC1: Given a base size control (14 to 18 px) and corner radius (0 to 16 px), When I change them, Then the preview updates.
- AC2: Given reset, When pressed for a field, Then it returns to default.
- Edge: limits prevent unreadable sizes.
- Error: out of range values are clamped with a message.
- Empty: not applicable.

### M18-S05 Logo and platform name (Must)
As an admin, I want to set my logo and platform name, so that the site carries my identity.
- AC1: Given I upload a logo (SVG or PNG, up to 500 KB), When processed, Then the SVG is sanitised, sizes for header, favicon and PWA icons are generated.
- AC2: Given I change the platform name, When saved, Then it updates headings, the page title, emails and manifest name.
- AC3: Given there is no logo, When the header renders, Then the platform name shows as text.
- Edge: logo is shown in preview on light and dark backgrounds.
- Error: invalid or unsafe SVG is rejected with a reason.
- Empty: default text logo.

### M18-S06 Live preview (Must)
As an admin, I want to see the effect while editing, so that I do not need to guess.
- AC1: Given the preview, When I change anything, Then Home, Watch and Sign in previews update live (tabs), at desktop and mobile widths.
- AC2: Given I have not saved, When I leave, Then I am warned about unsaved changes.
- Edge: preview uses the real components and sample content when the catalog is empty.
- Error: preview failure shows a message but editing remains.
- Empty: not applicable.

### M18-S07 Save, publish and reset (Must)
As an admin, I want to save a draft theme, publish it, or reset to default, so that I can experiment safely.
- AC1: Given I press Publish theme and confirm, When saved, Then the theme is stored as CSS variables in the database, applied on the next page load for all viewers (cache bust within 60 seconds), and an audit entry is written.
- AC2: Given Reset to default, When confirmed, Then default values are restored (draft only until published).
- AC3: Given an invalid stored theme, When rendering, Then the system falls back to defaults and logs an error (never a broken page).
- Edge: the published theme is injected inline in the first HTML so there is no flash of default colours.
- Error: publish failure keeps the previous theme live.
- Empty: not applicable.

### M18-S08 Theme history (Should)
As an admin, I want to restore a previous theme, so that I can undo a change.
- AC1: Given `Theme history`, When I open it, Then I see the last 20 versions with date, editor, and a colour swatch strip.
- AC2: Given I press Restore on one, When confirmed, Then it becomes the draft, and I publish when ready.
- Edge: compare view of two versions (Could).
- Error: not applicable.
- Empty: the default theme is the only version.

### M18-S09 Safe theming rules (Must)
As the developer, I want the theme to be only CSS variables, so that it cannot break layout or security.
- AC1: Given the theme data, When rendered, Then only whitelisted variable names with validated values are output, escaped, in a single style element with a CSP nonce.
- AC2: Given a malicious value is submitted, When saved, Then validation rejects it (no `url()`, no expressions, no braces).
- Edge: tests cover injection attempts.
- Error: validation failure returns 422.
- Empty: not applicable.

---

## M19 Analytics

### M19-S01 Record play events (Must)
As the owner, I want views and watch time recorded, so that I can see what is used.
- AC1: Given a playback starts, When 3 seconds have played, Then a view is recorded once per play session.
- AC2: Given playback continues, When each 10 second progress is saved, Then watch time accumulates (seconds actually played, not seek jumps).
- AC3: Given the finish threshold, When reached, Then a completion is recorded once per session.
- Edge: previews by admins and bots are excluded.
- Edge: guest plays count like any other play.
- Error: event write failure never affects playback.
- Empty: not applicable.

### M19-S02 Overview dashboard (Must)
As an admin, I want a summary of performance, so that I can see the trend.
- AC1: Given `/admin/analytics`, When it loads, Then I see total views, unique viewers, total watch time, average watch time per viewer and completion rate for the selected range (default last 30 days) with a comparison to the previous period.
- AC2: Given a range picker (7, 30, 90 days, custom), When changed, Then all tiles and charts update and the range is in the URL.
- AC3: Given charts, When rendered, Then they have text alternatives and a table view toggle.
- Edge: numbers use `en-NG` formatting and Africa/Lagos days.
- Error: partial failure shows retry per tile.
- Empty: "No views yet. Data will appear once people watch".

### M19-S03 Top titles and per video analytics (Must)
As an admin, I want to see which titles do best, so that I can make more of them.
- AC1: Given the Top titles table, When shown, Then it lists title, views, watch time, completion rate, average percent watched, sortable. Likes, Love, Not for me and Positive share columns are available (M44-S06).
- AC2: Given I open a video, When the detail loads, Then I see a daily views chart and a retention curve (percent still watching by time).
- Edge: archived titles can be included with a toggle.
- Error: load failure shows retry.
- Empty: titles with no views show zero rows or the empty message.

### M19-S04 Audience splits (Should)
As an admin, I want device and country splits, so that I know who is watching.
- AC1: Given the split charts, When shown, Then device class (phone, desktop, tablet, TV), connection class (Save-Data on or off), and country (coarse, from the CDN header) show as percentages.
- AC2: Given fewer than 10 viewers in a group, When shown, Then it is grouped into Other (privacy).
- Edge: no IP address is stored.
- Error: not applicable.
- Empty: see M19-S02.

### M19-S05 CSV export (Should)
As an admin, I want to export data, so that I can share a report.
- AC1: Given I press Export CSV, When the range is set, Then a CSV of daily views and watch time per title downloads.
- AC2: Given the export is large, When requested, Then it is generated in the background and a download link appears.
- Edge: formula injection characters are neutralised in cells.
- Error: failure shows retry.
- Empty: a CSV with headers only.

### M19-S06 Daily rollups (Must)
As the developer, I want aggregates precomputed, so that dashboards are fast.
- AC1: Given the job runs nightly at 02:00 Africa/Lagos, When complete, Then daily per title and per site stats are written idempotently.
- AC2: Given a rerun for a past date, When run, Then results are replaced, not duplicated.
- Edge: today's numbers are computed live with a small cache.
- Error: job failure alerts the developer.
- Empty: not applicable.

### M19-S07 Privacy of analytics (Must)
As a viewer, I want analytics to respect my privacy, so that I am not tracked across the web.
- AC1: Given the platform, When it records events, Then it stores profile id and video id for resume only, and uses an anonymous daily rotating id for analytics counts. For guests that id is a hash of the guest id and the day, so the guest id is never stored in analytics (M40-S16).
- AC2: Given the privacy page, When viewed, Then it states what is measured and names the guest cookie.
- Edge: no third party scripts.
- Error: not applicable.
- Empty: not applicable.

---

## M20 Audit log

### M20-S01 Record audit entries (Must)
As the owner, I want every important action recorded, so that I can see who did what.
- AC1: Given an admin creates, edits, deletes, publishes, approves captions, changes theme, roles or settings, When it succeeds, Then an entry stores actor, role, action, target type and id, summary, before and after (secrets redacted), IP, user agent and time.
- AC2: Given viewer sensitive events (password change, email change, lockout, deletion request), When they occur, Then entries are written with the account id.
- AC3: Given the write fails, When the main action succeeded, Then the action is rolled back (audit and action in one transaction) for admin writes.
- Edge: entries cannot be edited or deleted through the app.
- Error: failure surfaces to the admin as an error and is logged.
- Empty: not applicable.

### M20-S02 Browse the audit log (Must)
As a Super admin, I want a searchable log screen, so that I can investigate.
- AC1: Given `/admin/audit-log`, When it loads, Then entries show newest first with filters for actor, action type, target, and date range, and cursor pagination.
- AC2: Given an entry, When I open it, Then a detail panel shows before and after as a readable diff.
- AC3: Given an Admin role, When they open it, Then they see content actions only (not security entries) unless Super admin.
- Edge: URL holds filters.
- Error: load failure shows retry.
- Empty: "No activity matches these filters".

### M20-S03 Export audit log (Should)
As a Super admin, I want to export entries, so that I can keep records.
- AC1: Given filters, When I press Export, Then a CSV for the filtered range downloads (background job if over 10,000 rows).
- Edge: neutralise spreadsheet formulas.
- Error: failure shows retry.
- Empty: a CSV with headers only.

### M20-S04 Retention (Should)
As the owner, I want old entries removed after a period, so that the log does not grow forever.
- AC1: Given a retention setting (default 24 months), When the monthly job runs, Then older entries are purged and the purge itself is logged.
- Edge: legal hold flag pauses purge (Could).
- Error: failure alerts.
- Empty: not applicable.

### M20-S05 Tamper evidence (Could)
As the owner, I want to detect edits to the log, so that I can trust it.
- AC1: Given each entry stores a hash of its content and the previous entry's hash, When verification runs, Then a broken chain is reported.
- Edge: verification runs weekly.
- Error: broken chain alerts the developer.
- Empty: not applicable.

---

## M21 Notifications and email

### M21-S01 Send transactional email reliably (Must)
As the owner, I want emails to be sent reliably, so that people get their codes and links.
- AC1: Given an email is requested, When queued in the outbox, Then the worker sends via the provider, records the provider message id and status, and retries on failure with backoff up to 5 times.
- AC2: Given a bounce or complaint, When the webhook arrives, Then the address is flagged and further non-essential emails stop.
- AC3: Given templates, When rendered, Then each has HTML and plain text, a single column layout under 30 KB, and no tracking pixels.
- Edge: sender name and address come from site configuration.
- Error: provider outage queues emails and alerts the developer after 10 minutes.
- Empty: not applicable.

### M21-S02 Email templates (Must)
As a viewer, I want clear, short emails, so that I know what to do.
- AC1: Given each template (verification, welcome, password reset, password changed, sign-in lockout notice, account deletion confirmation, export ready), When sent, Then the subject states the purpose, the main action is a button and a plain link, and a support address is included.
- AC2: Given the code email, When shown, Then the 6 digit code appears large and also in the subject preview is avoided (not shown in the subject).
- Edge: copy follows UI writing rules (no dashes, no emojis).
- Error: missing variable fails the send and logs (never sends "undefined").
- Empty: not applicable.

### M21-S03 Admin notices (Should)
As an admin, I want in-app and email notices for jobs, so that I know when to act.
- AC1: Given encoding completes or fails, or captions are ready, When it happens, Then a notice appears in the admin bell and the uploader receives an email if enabled in their preferences (default: failures only).
- AC2: Given I open the bell, When I mark all as read, Then the badge clears.
- Edge: batched into a single summary email per hour to avoid spam.
- Error: notice failure does not affect the job.
- Empty: "Nothing new".

### M21-S04 Email deliverability setup (Must)
As the developer, I want proper domain authentication, so that emails reach inboxes.
- AC1: Given the sending domain, When configured, Then SPF, DKIM and DMARC records are documented in DEPLOYMENT and a check script verifies them.
- AC2: Given a test send, When delivered to major providers, Then it lands in inbox (manual checklist).
- Edge: until the final domain exists, a developer domain is used and marked in config.
- Error: failing check blocks go live (checklist item).
- Empty: not applicable.

### M21-S05 Notification preferences (Could)
As an admin, I want to choose which emails I get, so that my inbox is not flooded.
- AC1: Given `/admin/account`, When I toggle categories (failures, captions ready, daily summary), Then they save per admin.
- Edge: security emails cannot be turned off.
- Edge: viewer notification settings are separate and live at /account/notifications (M44-S14).
- Error: not applicable.
- Empty: not applicable.

---

## M22 Storage and CDN

### M22-S01 Bucket layout and CDN domain (Must)
As the developer, I want a clear storage layout, so that everything is findable and safe.
- AC1: Given R2, When configured, Then sources are under a private prefix, renditions and captions under a CDN fronted prefix, backups in a separate bucket, and images under `images/`.
- AC2: Given the custom domain (for example `video.<domain>`), When a request arrives, Then it is served by Cloudflare CDN from R2 with correct CORS for the site origin only.
- AC3: Given the architecture rule, When reviewed, Then no video bytes are served from the VPS or proxied through Cloudflare from the VPS.
- Edge: domain is configuration, not code.
- Error: misconfigured CORS is caught by a deploy smoke test.
- Empty: not applicable.

### M22-S02 Presigned upload URLs (Must)
As the system, I want short lived presigned URLs for uploads, so that admins upload straight to R2 without exposing keys.
- AC1: Given an authorised admin, When an upload starts, Then the server issues part URLs valid for 1 hour for that object key only.
- AC2: Given a viewer or a non-admin requests one, When made, Then it is refused with 403.
- Edge: keys are generated server side (never client supplied paths).
- Error: R2 outage shows "Storage is unavailable. Try again shortly".
- Empty: not applicable.

### M22-S03 Storage usage and lifecycle (Should)
As an admin, I want to see storage used, so that costs are not a surprise.
- AC1: Given the dashboard, When it loads, Then storage by type (sources, renditions, captions, images, backups) is shown with a monthly estimate.
- AC2: Given lifecycle rules, When set, Then abandoned multipart parts are cleaned after 7 days.
- Edge: warning at 80 percent of the chosen budget.
- Error: usage query failure shows "Not available".
- Empty: zero state.

---

## M23 Security

### M23-S01 Password and session security (Must)
As the owner, I want strong default protections, so that accounts are hard to take over.
- AC1: Given a password, When stored, Then it is hashed with argon2id with tuned parameters and never logged.
- AC2: Given a session cookie, When issued, Then it is HttpOnly, Secure, SameSite=Lax, with a random 256 bit id stored hashed server side.
- AC3: Given a password change or reset, When completed, Then other sessions are revoked.
- Edge: constant time comparison for tokens.
- Error: any failure in hashing or session creation fails closed.
- Empty: not applicable.

### M23-S02 Security headers and CSRF (Must)
As the owner, I want browsers to enforce safe behaviour, so that common attacks fail.
- AC1: Given any page response, When served, Then it includes CSP (nonce based), HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and frame-ancestors none.
- AC2: Given a state changing request, When it lacks a valid CSRF token or same-origin signal, Then it is rejected with 403.
- Edge: Report-only mode is used first for CSP, then enforced.
- Error: CSP violations are logged.
- Empty: not applicable.

### M23-S03 Rate limiting (Must)
As the owner, I want limits on sensitive endpoints, so that abuse is blunted.
- AC1: Given limits (sign in, sign up, reset, resend, search, progress, key requests, guest playback sessions, public catalog reads), When exceeded, Then 429 with Retry-After is returned and the UI shows a plain wait message.
- AC2: Given the limiter store fails, When it is unreachable, Then auth endpoints fail closed and read endpoints fail open with a log (documented decision).
- Edge: carrier grade NAT is considered (IP limits are generous, account limits are strict).
- Error: see AC2.
- Empty: not applicable.

### M23-S04 Input validation and uploads (Must)
As the developer, I want all external input validated at the boundary, so that injection and abuse fail.
- AC1: Given any request body, When received, Then it is validated against a schema, with unknown fields rejected, and queries are parameterised.
- AC2: Given images and SVG uploaded by admins, When processed, Then they are re-encoded or sanitised and size limited.
- AC3: Given file names, When stored, Then user supplied names never become object keys.
- Edge: errors do not echo raw input.
- Error: 422 with field errors.
- Empty: not applicable.

### M23-S05 Dependency and secrets hygiene (Should)
As the developer, I want known issues caught early, so that we ship safely.
- AC1: Given CI, When it runs, Then dependency audit and secret scanning run and block on high severity.
- AC2: Given secrets, When deployed, Then they come from environment files outside git with least privilege R2 keys (separate keys for upload, worker and backup).
- Edge: key rotation procedure documented.
- Error: a leaked secret triggers the rotation runbook.
- Empty: not applicable.

---

## M24 Observability

### M24-S01 Logs and request ids (Must)
As the developer, I want structured logs with request ids, so that I can trace a problem.
- AC1: Given each request, When handled, Then a request id is generated, logged and returned in a response header, and errors include it.
- AC2: Given the error page, When shown, Then it displays the request id as "Reference" so a viewer can quote it.
- Edge: no passwords, tokens or full emails in logs.
- Error: logging failure never breaks requests.
- Empty: not applicable.

### M24-S02 Health checks and alerts (Must)
As the developer, I want automatic alerts, so that I know before the client does.
- AC1: Given `/healthz` and `/readyz`, When polled by an uptime monitor every minute, Then failure for 3 checks alerts me by email and push.
- AC2: Given the worker, When it misses heartbeats for 5 minutes, Then an alert is sent.
- AC3: Given disk above 85 percent, error rate spikes, or certificate expiry within 14 days, When detected, Then alerts are sent.
- Edge: alerts are deduplicated.
- Error: not applicable.
- Empty: not applicable.

### M24-S03 Error tracking (Should)
As the developer, I want exceptions captured with context, so that I can fix them.
- AC1: Given an unhandled error on server or client, When it occurs, Then it is captured with release version, route and request id (no personal data).
- Edge: noisy errors are grouped.
- Error: tracking outage is ignored silently by the app.
- Empty: not applicable.

### M24-S04 Player quality dashboard (Should)
As the developer, I want to see startup and rebuffer trends, so that I know viewer experience.
- AC1: Given player metrics, When aggregated, Then an admin view (Super admin) shows p50 and p75 startup time, rebuffer ratio, error rate by code, and rendition distribution, per day.
- Edge: filter by device class and connection class.
- Error: not applicable.
- Empty: "No playback data yet".

---

## M25 PWA and low-data

### M25-S01 Install to home screen (Should)
As Tobi, I want to add the site to my home screen, so that it opens like an app.
- AC1: Given the site meets installability rules, When I have visited at least twice and 3 days apart (or manually via the menu), Then an unobtrusive install banner appears once and can be dismissed for 30 days.
- AC2: Given I install, When opened, Then it runs in standalone mode with the theme colour, platform name and icons from site settings.
- Edge: iOS shows instructions for Add to Home Screen.
- Error: not applicable.
- Empty: not applicable.

### M25-S02 App shell caching and speed (Must)
As Tobi, I want the site to open fast on repeat visits, so that I do not waste data.
- AC1: Given the service worker, When active, Then the app shell, fonts and static assets are cached with versioning, and repeat visits load with no network for those assets.
- AC2: Given an update is deployed, When detected, Then it applies at next load with a small "Updated" notice (never mid-playback).
- AC3: Given performance budgets, When CI runs Lighthouse mobile, Then the first screen JavaScript is under 300 KB and LCP is within budget or the build fails.
- Edge: video segments and personal API responses are never cached by the service worker.
- Error: a broken service worker can be disabled by a kill switch in config.
- Empty: not applicable.

### M25-S03 Data saver mode (Must)
As Tobi, I want a Data saver setting, so that I use less of my bundle.
- AC1: Given Data saver is on, When I watch, Then quality is capped at 360p, hero rotation and hero preview clips are off, posters load at 320 px, and next episode is not prefetched.
- AC2: Given the browser sends Save-Data, When I first visit, Then Data saver defaults to on and I am told once.
- AC3: Given I toggle it in the player menu or settings, When changed, Then it applies at once and persists for the profile.
- AC4: Given Data saver is on, When I browse, Then the notification count is fetched only when I open the bell (M44-S11).
- Edge: the player shows an estimate "About 3 MB per minute at 360p" in settings.
- Error: not applicable.
- Empty: not applicable.

### M25-S04 Offline screen (Must)
As Tobi, I want a friendly screen when I have no signal, so that I know it is my network.
- AC1: Given I am offline, When I open a page not in cache, Then the Offline screen shows "You are offline", a Retry button, and a link to cached pages (Home shell, My List last view).
- AC2: Given I come back online, When detected, Then a toast "Back online" shows and pending writes sync.
- Edge: the page works with JavaScript disabled for its static text.
- Error: not applicable.
- Empty: not applicable.

### M25-S05 Queue writes while offline (Should)
As Tobi, I want my list and progress changes to survive a signal drop, so that nothing is lost.
- AC1: Given I add to My List or progress is saved while offline, When connectivity returns, Then queued writes send in order, deduplicated (latest per item).
- AC2: Given a queued write is rejected (401 or 403), When it fails, Then it is dropped and I am informed once.
- Edge: the queue is capped at 100 items and keyed by profile.
- Error: storage quota exceeded drops oldest and logs.
- Empty: not applicable.

### M25-S06 Image efficiency (Must)
As Tobi, I want small images, so that pages load quickly.
- AC1: Given posters, When served, Then AVIF or WebP in 320, 640, 960 widths with `srcset` and `sizes`, lazy loaded below the fold, with a blur or colour placeholder.
- AC2: Given the hero image, When Home loads, Then it is preloaded at the right size for the viewport.
- Edge: a total initial image budget of 300 KB on mobile.
- Error: format fallback to JPEG.
- Empty: not applicable.

### M25-S07 Unsupported browser notice (Could)
As a viewer on Opera Mini or a very old browser, I want a plain explanation, so that I know what to do.
- AC1: Given a browser lacking required features, When the site loads, Then a static page lists supported browsers and a link to install Chrome.
- Edge: no JavaScript needed.
- Error: not applicable.
- Empty: not applicable.

---

## M26 Settings and legal pages

### M26-S01 Legal pages (Must)
As a viewer, I want to read the terms and privacy policy, so that I know how my data is used.
- AC1: Given the footer, When I tap Terms or Privacy, Then the page opens at `/terms` or `/privacy` with last updated date and a table of contents.
- AC2: Given sign up, When I look at the form, Then a line "By creating an account you agree to the Terms and Privacy Policy" links to them.
- AC3: Given content is not yet supplied by the client, When shown, Then placeholder text is clearly marked "Draft" and the admin dashboard warns before launch.
- Edge: pages are readable offline after the first visit.
- Error: not found shows 404.
- Empty: not applicable.

### M26-S02 Edit pages in admin (Should)
As an admin, I want to edit the legal and About pages, so that I can keep them current.
- AC1: Given `/admin/site-settings` pages tab, When I edit with a simple editor (headings, paragraphs, lists, links), Then I can save a draft and publish, each publish creating a version.
- AC2: Given sanitising, When saved, Then HTML is cleaned to a safe subset.
- AC3: Given I restore an earlier version, When confirmed, Then it becomes the draft.
- Edge: the last updated date updates on publish.
- Error: save failure keeps text.
- Empty: not applicable.

### M26-S03 About, Contact and Help (Should)
As a viewer, I want to know who runs the platform and how to get help, so that I can trust it.
- AC1: Given About, When opened, Then it shows the platform story, mission and contact details from site config.
- AC2: Given Help, When opened, Then it answers common questions (verify email, reset password, data use, captions, install).
- Edge: a contact form is not included at launch (email address only), to avoid spam handling.
- Error: not applicable.
- Empty: not applicable.

### M26-S04 Error pages (Must)
As a viewer, I want helpful 404 and error pages, so that I can recover.
- AC1: Given a missing page, When opened, Then the 404 shows a message, Search and Home links, and keeps the header.
- AC2: Given a server error, When shown, Then the page says what happened in plain words, offers Retry and Home, and shows a Reference id.
- Edge: pages are lightweight and work offline from cache.
- Error: this is the error state.
- Empty: not applicable.

### M26-S05 Viewer settings hub (Should)
As a viewer, I want one place for settings, so that I can find them.
- AC1: Given `/account` and `/settings/playback`, When I navigate, Then they are linked with a tab or list and consistent layout.
- AC2: Given language, When shown, Then the enabled languages are listed by their own names with the current one selected (M46-S01), and with only English enabled the row is hidden.
- Edge: a kids profile cannot access this hub.
- Error: load failure shows retry.
- Empty: not applicable.

### M26-S06 Cookie and storage notice (Could)
As a viewer in a region that needs consent, I want to be informed about storage, so that rules are respected.
- AC1: Given the site only uses essential cookies and local storage (the session, profile, guest and Kids mode cookies and device progress), When first visited, Then a short notice appears once with a link to Privacy and no tracking choices (none exist).
- Edge: shown only where config says so.
- Error: not applicable.
- Empty: not applicable.

---

## M27 Admin users and profiles overview

### M27-S01 Search viewer accounts (Should)
As an admin, I want to find a viewer's account, so that I can help them.
- AC1: Given `/admin/users`, When I search by email (partial) or id, Then matching accounts show with status, created date, last active and profile count.
- AC2: Given an Analyst role, When they open it, Then they see counts only, not emails.
- Edge: emails are partially masked for the Editor role.
- Error: load failure shows retry.
- Empty: "No accounts match".

### M27-S02 View an account (Should)
As an admin, I want to see an account's state, so that I can diagnose sign in problems.
- AC1: Given an account, When I open it, Then I see email verified state, lock state, last sign in, active session count, and profiles (name, kids flag, created).
- AC2: Given privacy, When shown, Then watch history is not shown.
- Edge: no passwords or tokens are ever shown.
- Error: not found shows 404.
- Empty: not applicable.

### M27-S03 Support actions (Should)
As an admin, I want safe actions on an account, so that I can fix common problems.
- AC1: Given an account, When I choose Resend verification, Unlock, Send password reset, Force sign out or Suspend, Then a confirmation shows and the action runs.
- AC2: Given any action, When done, Then an audit entry is written with a reason (required for Suspend).
- AC3: Given Delete account, When requested by the owner, Then only a Super admin can run it after a typed confirmation.
- Edge: an admin cannot act on their own account here.
- Error: failure shows a message and nothing changes.
- Empty: not applicable.

### M27-S04 Users overview figures (Could)
As an admin, I want a summary of sign ups, so that I can see growth.
- AC1: Given the Users header, When loaded, Then it shows total accounts, verified percentage, new in 7 days, and active in 30 days.
- Edge: figures exclude test accounts flagged by an admin.
- Error: retry per tile.
- Empty: zeros.

---

## M29 Site configuration

### M29-S01 Platform details (Must)
As an admin, I want to set platform name, tagline and contacts, so that nothing is hardcoded.
- AC1: Given `/admin/site-settings`, When I edit name, tagline, support email, social links, default language, interface languages and caption languages (M46-S06), Then they are saved and used in the header, emails, titles, manifest and footer.
- AC2: Given empty required values, When saving, Then validation shows which are missing.
- Edge: changing the name does not change the technical identifiers.
- Error: save failure keeps edits.
- Empty: defaults are placeholders marked "Not set" with a launch checklist warning.

### M29-S02 Feature flags and limits (Must)
As a Super admin, I want switches and limits, so that I can change behaviour without a deploy.
- AC1: Given the flags, When I change them (sign up open or invite only, kids profiles on, My List on, autoplay default, data saver default, captions required, profile limit, lockout thresholds, finish and start thresholds, rewind seconds, maturity labels, guest maximum rating, trending window and minimums, Most liked minimums, notice retention), Then they apply within 60 seconds.
- AC2: Given an invalid value (negative, too large), When saving, Then it is rejected with limits shown.
- Edge: every change is audited with old and new values.
- Error: config read failure falls back to compiled safe defaults and logs.
- Empty: defaults shown.

### M29-S03 Invite only sign up (Should)
As the owner, I want to close public sign up during a soft launch, so that I can control who joins.
- AC1: Given sign up is invite only, When a visitor opens `/sign-up`, Then they see "Sign up is by invitation" and an invite code field.
- AC2: Given an invite code is valid, When used, Then sign up proceeds and the code usage is counted.
- Edge: codes have a use limit and an expiry; admin can create and revoke codes.
- Error: invalid code shows a generic message.
- Empty: no codes yet.

### M29-S04 Maintenance banner (Could)
As an admin, I want to show a notice or maintenance mode, so that viewers know about planned work.
- AC1: Given a banner message and window, When enabled, Then a slim banner shows on all pages for viewers.
- AC2: Given maintenance mode, When on, Then viewers see a maintenance page (HTTP 503) and admins can still sign in.
- Edge: playback in progress is not interrupted by the banner.
- Error: not applicable.
- Empty: not applicable.

---

## M30 Job queue and scheduler

### M30-S01 Reliable jobs (Must)
As the developer, I want background jobs with retry, so that work completes despite failures.
- AC1: Given a job, When it fails, Then it retries with exponential backoff up to its limit, then becomes `dead`.
- AC2: Given a worker crashes mid job, When its visibility timeout ends, Then another worker takes it.
- AC3: Given jobs are idempotent, When run twice, Then the outcome is the same.
- Edge: jobs have a type, payload schema and timeout.
- Error: dead jobs raise an alert.
- Empty: not applicable.

### M30-S02 Scheduled jobs (Must)
As the developer, I want recurring jobs, so that routine work happens by itself.
- AC1: Given schedules, When time passes, Then jobs run for: publish scheduled videos (every minute), analytics rollup (nightly), orphan upload cleanup (daily), expired sessions and tokens cleanup (daily), trash purge (daily), backups (nightly), audit retention (monthly).
- AC2: Given two app instances, When both schedule, Then a lock ensures a job runs once.
- Edge: missed runs are caught up.
- Error: failures alert.
- Empty: not applicable.

### M30-S03 Dead jobs screen (Should)
As a Super admin, I want to see failed jobs and retry them, so that I can recover.
- AC1: Given the Jobs tab in System, When I open it, Then I see dead and failed jobs with type, reason, attempts, time and Retry and Discard actions.
- AC2: Given I retry, When pressed, Then the job re-queues and the action is audited.
- Edge: payloads are shown redacted.
- Error: not applicable.
- Empty: "No failed jobs".

### M30-S04 Job concurrency control (Should)
As the developer, I want heavy jobs limited, so that the server stays responsive.
- AC1: Given encoding and captioning are heavy, When queued, Then at most 1 encode and 1 caption job run at once (configurable).
- AC2: Given light jobs, When queued, Then they are not blocked by heavy ones (separate queues).
- Edge: priorities per queue.
- Error: not applicable.
- Empty: not applicable.

---

## M31 Playback authorization

### M31-S01 Signed playlist for authorised viewers (Must)
As the owner, I want a playable URL only for a signed in viewer with an active profile or for a guest session, so that videos are not freely hot-linked.
- AC1: Given an authorised profile or a guest requests playback, When the server verifies the session or guest cookie, the video visibility (published) and the kids filter, Then it returns a signed master playlist URL and a 30 minute token, with segment URLs valid for 2 hours for accounts and 20 minutes for guests.
- AC2: Given a suspended account, a hidden video, or guest play switched off, When requested, Then it returns 401 or 404 with no URL.
- AC3: Given a kids profile or a guest in Kids mode and a non-kid video, When requested, Then it returns 404.
- Edge: URLs are bound to the video id and expire.
- Error: failure to sign returns 500 with a request id.
- Empty: not applicable.

### M31-S02 HLS key endpoint (Must)
As the owner, I want the AES key served only to authorised players, so that stolen segments are useless.
- AC1: Given the player requests the key, When the playback token (account or guest) is valid and the video visible, Then the 16 byte key is returned with no-store caching.
- AC2: Given an invalid request, When denied, Then 403 and an audit-light log line are written.
- AC3: Given key requests exceed 20 per 10 minutes per profile or guest, or 300 per minute per IP, When exceeded, Then 429.
- Edge: the key URL cannot be used from another origin (CORS and cookie).
- Error: key missing for a video blocks publish.
- Empty: not applicable.

### M31-S03 Segment access control (Must)
As the owner, I want segments to need a valid token, so that direct links expire.
- AC1: Given signed cookies or query tokens issued with the playlist, When segment requests arrive at the CDN, Then Cloudflare validates them (token auth) and rejects expired ones.
- AC2: Given a token near expiry during playback, When 30 minutes remain of lifetime, Then the player refreshes it silently (M08-S21).
- Edge: tokens are scoped to the video path prefix.
- Edge: guest segment URLs live 20 minutes and account ones 2 hours. The player refreshes an expired URL through a new session (M08-S21).
- Error: CDN misconfiguration is caught by a smoke test in deploy.
- Empty: not applicable.

### M31-S04 Preview tokens for admin (Should)
As an admin, I want to preview unpublished videos, so that I can check them.
- AC1: Given admin sign in with the right permission, When requesting a preview, Then a token valid for 1 hour is issued for that video and role.
- AC2: Given a viewer session, When requesting a preview of a hidden video, Then it is denied.
- Edge: previews do not record analytics or progress.
- Error: not applicable.
- Empty: not applicable.

---

## M32 Data lifecycle: backup, export, deletion

### M32-S01 Nightly backups (Must)
As the owner, I want automatic backups, so that I can recover from loss.
- AC1: Given 03:00 Africa/Lagos daily, When the job runs, Then the Postgres database is dumped, compressed, encrypted and uploaded to the backup bucket, with 14 daily and 8 weekly copies kept.
- AC2: Given a backup, When it finishes, Then a manifest records size, checksum and time, and failure alerts the developer.
- Edge: backup bucket credentials cannot delete outside the retention policy.
- Error: a missing backup for 36 hours triggers an alert.
- Empty: not applicable.

### M32-S02 Restore drill (Must)
As the developer, I want a tested restore procedure, so that backups are real.
- AC1: Given the runbook in DEPLOYMENT, When a restore is run to a scratch server, Then the app starts with restored data and a checklist passes.
- AC2: Given the drill, When done each quarter, Then the date is recorded in `ai-context.md`.
- Edge: restore time is measured.
- Error: failed drill opens an issue.
- Empty: not applicable.

### M32-S03 Account deletion purge (Should)
As a viewer, I want deletion to really remove my data, so that I can leave.
- AC1: Given the grace period ends, When the purge job runs, Then rows for account, profiles, sessions, progress, ratings, notices, notification settings, push subscriptions, lists and search history are deleted, and backups age out under the retention policy (documented in the Privacy page).
- AC2: Given audit entries, When purged, Then only hashed identifiers remain.
- Edge: cancelling within the grace period restores everything.
- Error: partial purge retries until complete.
- Empty: not applicable.

### M32-S04 Source video safekeeping (Could)
As the owner, I want a second copy of source videos, so that I never lose the masters.
- AC1: Given sources in R2, When the weekly job runs, Then new sources are copied to a second bucket (ideally another provider account) and verified by checksum.
- Edge: the client keeps the originals on her own storage too.
- Error: copy failure alerts.
- Empty: not applicable.

---

## M33 Deployment and CI

### M33-S01 Reproducible deploy (Must)
As the developer, I want one command to deploy, so that releases are safe.
- AC1: Given a merged pull request to main, When CI passes, Then an image is built, migrations run, and the Compose stack restarts with health checks, rolling back on failure.
- AC2: Given staging and production, When deploying, Then each has its own environment config and database.
- Edge: deploy output is logged and the release version is visible in the admin footer.
- Error: failed health check rolls back automatically.
- Empty: not applicable.

### M33-S02 CI checks (Must)
As the developer, I want automated checks on each pull request, so that problems are found early.
- AC1: Given a pull request, When opened, Then lint, typecheck, scoped tests for changed paths, a dash and emoji grep, secret scanning and a build run.
- AC2: Given any em or en dash in the diff, When detected, Then CI fails.
- Edge: the full suite is not run by contributors locally (rule in `CLAUDE.md`).
- Error: failures block merging.
- Empty: not applicable.

### M33-S03 Domain and HTTPS (Should)
As the developer, I want HTTPS and DNS set up cleanly, so that the site is trusted.
- AC1: Given the domain, When DNS is configured, Then the site and the CDN subdomain have valid certificates with auto renewal and HSTS.
- Edge: the domain is configuration and can change without code edits.
- Error: expiry alert at 14 days.
- Empty: not applicable.

---

## M34 Accessibility and internationalisation

### M34-S01 Keyboard and focus (Must)
As a keyboard user, I want to reach and use every control, so that I can use the site without a mouse.
- AC1: Given any screen, When I press Tab, Then focus order follows visual order with a visible focus ring (at least 3 to 1 contrast), and a Skip to content link is first.
- AC2: Given dialogs and menus, When opened, Then focus is trapped and returns to the trigger on close, and Escape closes them.
- Edge: rows are operable by keyboard (arrows scroll).
- Error: axe checks in CI fail on regressions.
- Empty: not applicable.

### M34-S02 Screen reader support (Must)
As a screen reader user, I want meaningful labels and announcements, so that I know what is happening.
- AC1: Given images, When rendered, Then posters have alt text (title) or are decorative when the title is adjacent.
- AC2: Given toasts, loading and errors, When they appear, Then they are announced politely (assertive for errors).
- AC3: Given forms, When invalid, Then errors are associated with fields and focus moves to the first error.
- Edge: page titles change on route changes and focus is moved to the main heading.
- Error: not applicable.
- Empty: not applicable.

### M34-S03 Motion, contrast and text size (Must)
As a viewer with sensitivity or low vision, I want the site to respect my settings, so that it is comfortable.
- AC1: Given reduced motion, When on, Then rotations, shimmer and slides are reduced or removed.
- AC2: Given browser text zoom to 200 percent, When used, Then no content is lost or overlapping.
- AC3: Given the default theme, When tested, Then text meets 4.5 to 1.
- Edge: dark player area controls meet contrast on any poster.
- Error: not applicable.
- Empty: not applicable.

### M34-S04 Text in catalogs (Should)
As the developer, I want all UI text in message catalogs, so that new languages are easy later.
- AC1: Given UI strings, When added, Then they live in a message catalog keyed by id, with plural and number formatting by the locale's Intl data with fallback to `en-NG`. Locales are en, yo, ig, ha and pcm; English is the source.
- AC2: Given a lint rule, When a hardcoded user-facing string is found in a component, Then CI warns.
- Edge: dates and durations come from the catalog and Intl ("6 min" in English).
- Error: a missing key falls back to English for that key only, and the key is recorded in the missing key report (M46-S10).
- Empty: not applicable.

---

## M36 Artwork and thumbnails

### M36-S01 Generate poster candidates (Must)
As an admin, I want automatic poster options, so that I do not need an image editor.
- AC1: Given encoding finishes, When the artwork step runs, Then 6 frames are extracted at evenly spaced points (avoiding black frames and blur by a simple score) and saved as candidates.
- AC2: Given I open the video, When candidates exist, Then I choose one in a grid.
- Edge: if all frames score low, a warning suggests uploading a custom image.
- Error: failure shows the placeholder and allows custom upload.
- Empty: not applicable.

### M36-S02 Responsive image variants (Must)
As Tobi, I want the right size image for my screen, so that pages are light.
- AC1: Given a chosen poster, When saved, Then variants in 320, 640 and 960 pixel widths (AVIF or WebP plus JPEG) and a 16 by 9 card crop and a hero crop are created.
- AC2: Given variants, When served, Then they have immutable cache headers with a content hash in the path.
- Edge: a blur placeholder of under 1 KB is stored.
- Error: processing failure retries via the job queue.
- Empty: not applicable.

### M36-S03 Hero image and focus point (Should)
As an admin, I want to control how a hero image is cropped, so that faces and text are not cut.
- AC1: Given the hero crop tool, When I move a focus point, Then the 21 by 9 and 16 by 9 crops follow it with a preview.
- AC2: Given overlay text, When shown, Then a safe area guide is displayed.
- Edge: saved focus applies to all variants.
- Edge: the focus point also positions the preview clip crop (object-position).
- Error: not applicable.
- Empty: not applicable.

### M36-S04 Seek preview sprite (Could)
As a viewer, I want preview thumbnails on the seek bar, so that I can find a moment.
- AC1: Given encoding, When the optional sprite step is enabled, Then one frame every 5 seconds is packed into sprite sheets (max 5 columns) with a VTT map.
- AC2: Given the player, When Data saver is off, Then it fetches the sprite lazily on first hover.
- Edge: disabled by default to save encoding time.
- Error: failure is non-blocking.
- Empty: not applicable.

---

## M42 Admin polish and bulk operations

### M42-S01 One table alignment rule and padded containers (Must)
As an admin, I want columns lined up the same way on every screen, so that I can scan figures and never see text touching a box edge.
- AC1: Given any admin table, When it renders, Then quantity columns (counts, sizes, durations, percentages, days left, rows) have a right aligned header and right aligned cells with tabular numerals, and text, dates and status columns are left aligned.
- AC2: Given the Captions table, When it renders, Then the Cues header sits directly above the right aligned values.
- AC3: Given the Encoding queue and Failed encodes lists, When they render, Then text, bars and banners keep the card padding and never touch the card border.
- AC4: Given a phone width, When a table has more than four columns, Then it scrolls sideways with the first column fixed, or becomes stacked cards (Captions, Trash, Users), and nothing is clipped.
- Edge: a numeric column that sometimes shows words ("Working", "None") right aligns the words too.
- Error: not applicable.
- Empty: empty tables keep the card padding around the empty state.

### M42-S02 Breadcrumbs line up and fit (Must)
As an admin or viewer, I want the trail above the page title to read as one tidy line, so that I know where I am.
- AC1: Given any page with a breadcrumb, When it renders, Then every crumb, link or current page, sits on the same line at the same height.
- AC2: Given a very long title as the last crumb, When shown on desktop, Then it is cut with an ellipsis (full text on hover and for screen readers) and the heading below is not pushed down.
- AC3: Given a phone width, When a page has two or more crumbs, Then only the parent shows, as a back link of at least 44px, and the full trail stays available to screen readers.
- AC4: Given every admin page, When tested, Then the trail starts with Admin linking to `/admin` and the last crumb is not a link.
- Edge: the viewer title page uses the same component.
- Error: not applicable.
- Empty: a page with one crumb shows it as the current page.

### M42-S03 Select rows and see what is selected (Must)
As an admin, I want to select rows and see a bar with the count and the actions that fit, so that I can change many things in one go.
- AC1: Given a list with bulk actions, When I tick rows, Then a bar shows "N selected", announces the count to screen readers and lists only the actions my role may use; actions I may not use are disabled with the reason.
- AC2: Given I tick the header box, When the page is selected, Then only the rows on the page are selected.
- AC3: Given a phone width, When rows are selected, Then the bar sits at the bottom with the main action visible and the rest under More.
- AC4: Given live updates (Encoding), When the list refreshes, Then my selection is kept, and rows that disappeared are dropped from it.
- Edge: Clear empties the selection and moves focus back to the list.
- Error: not applicable.
- Empty: no selection means no bar.

### M42-S04 Results report and retry failed (Must)
As an admin, I want to see what worked and what did not after a bulk action, so that nothing fails silently.
- AC1: Given a run where every item worked, When it ends, Then a toast says "Action: N done."
- AC2: Given some items failed or were skipped, When it ends, Then a panel lists each with the plain reason and the counts of done, failed and skipped.
- AC3: Given retryable failures (network, timeout, busy), When I press "Retry the N that failed", Then only those run again and the panel updates; failures such as permission or not ready are not offered for retry.
- AC4: Given the connection drops partway, When it happens, Then the panel says how many were done before it dropped and offers Continue.
- Edge: Copy list puts titles and reasons on the clipboard.
- Error: a run that fails before changing anything says "Nothing was changed" and keeps my selection.
- Empty: not applicable.

### M42-S05 Progress for large selections (Should)
As an admin, I want to see progress when I change many items, so that I know it is working.
- AC1: Given more than 25 items, When the action runs, Then it runs in chunks of 25 and shows "Done 50 of 120" with a progress bar.
- AC2: Given I press Cancel, When a chunk is in progress, Then the run stops after that chunk and the report says how many were done.
- AC3: Given I go offline, When a chunk cannot be sent, Then the run pauses with a note and resumes when I am back online.
- Edge: the server never accepts more than 200 ids in one call.
- Error: a failed chunk is reported with its ids.
- Empty: not applicable.

### M42-S06 Select across pages (Should)
As an admin, I want to apply a safe change to everything that matches my filter, so that I do not tick page after page.
- AC1: Given a full page is selected and more rows match, When I choose "Select all N that match", Then up to 500 matching items are selected and the bar says so.
- AC2: Given the action is publish, trash, delete forever, approve captions, or any user, staff or series delete, When rows match across pages, Then the option is not offered.
- AC3: Given the filter changes, When I change it, Then the selection clears.
- Edge: if more than 500 match, the bar says the first 500 are used.
- Error: items that changed since the filter ran are reported per item.
- Empty: not applicable.

### M42-S07 Undo for reversible bulk actions (Should)
As an admin, I want a short Undo after a bulk change, so that a slip costs nothing.
- AC1: Given a reversible action completed, When the toast shows, Then Undo is available for 10 seconds.
- AC2: Given I press Undo, When it runs, Then only the items still in the state the action left them in are reverted, and the result is reported like any bulk run.
- AC3: Given an action that cannot be undone (approve captions, delete forever, retry encodes, staff changes), When it completes, Then no Undo is shown and the confirm dialog said so.
- Edge: Undo is checked against the same permissions as the action.
- Error: items that cannot be reverted are listed.
- Empty: not applicable.

### M42-S08 Bulk approve captions (Must)
As an admin, I want to approve many caption tracks at once, so that a backlog does not take hours, without letting unchecked text through by accident.
- AC1: Given selected tracks, When I open Approve, Then I see how many will be approved and how many will be skipped (failed, still generating, none, already approved, or with warnings), each with its reason.
- AC2: Given some tracks were made by the computer and never opened or edited, When I confirm, Then the dialog warns that auto captions can get names, places and numbers wrong, offers "Show those first", and needs a tick before it approves them.
- AC3: Given I confirm, When it runs, Then each track is approved through the normal approval (version stored, VTT published, audit row) and a failure on one leaves only that track unchanged.
- AC4: Given an Editor, When they select tracks, Then bulk approve is disabled with "Only an admin can approve captions in bulk" while single approval still works.
- Edge: tracks with validation warnings are never bulk approved; they are opened one at a time.
- Error: a publish failure lists that track with the reason and a Retry.
- Empty: no eligible tracks disables the button and says why.

### M42-S09 Bulk retry encodes (Must)
As an admin, I want to retry all failed encodes at once, so that a bad night does not need many clicks.
- AC1: Given failed jobs on Encoding or Failed encodes, When I select them and press Retry, Then each job with its original file goes back in the queue, oldest failure first.
- AC2: Given a job whose original file was removed, When included, Then it is skipped with "Replace the file instead".
- AC3: Given the confirm dialog, When shown, Then it says the jobs run one after another.
- AC4: Given Failed encodes, When rows have leftover files, Then Clean up works on the selection as well as on all.
- Edge: running and queued jobs have no checkbox.
- Error: a job that cannot be queued is listed with its reason.
- Empty: with no failed jobs the bar and checkboxes do not appear.

### M42-S10 Bulk actions on viewer accounts (Should)
As an admin, I want to handle several viewer accounts at once, so that support is quick when many people have the same problem.
- AC1: Given selected accounts, When I choose Suspend, Then I enter one reason (3 or more characters) that is saved on every account and audit row.
- AC2: Given selected accounts, When I choose Reinstate, Force sign out or Resend verification, Then it runs on each with a confirm that states the count.
- AC3: Given accounts already verified, already suspended, or emailed in the last hour, When included, Then they are skipped with that reason.
- AC4: Given my own account is in the list, When I try to select it, Then it cannot be selected.
- Edge: at most 50 accounts per run; no bulk delete.
- Error: per account failures are listed.
- Empty: no matching accounts shows "No users match." and no checkboxes.

### M42-S11 Bulk actions on staff and invites (Should)
As a Super admin, I want to change several staff roles or resend invites together, so that onboarding a team is quick, with safeguards.
- AC1: Given selected Editors and Admins, When I change their role to Editor or Admin and confirm with re-authentication, Then each changes and is audited with the old and new role.
- AC2: Given the batch includes me or a Super admin, or the new role is Super admin, When I try, Then it is refused with the reason and nothing changes.
- AC3: Given I disable several staff, When I confirm, Then it is all or nothing, their admin sessions end at once, and a batch that would leave no Super admin is refused with "There must be at least one Super admin".
- AC4: Given pending invites, When I choose Resend, Then each pending invite not sent in the last hour is resent (at most 20), and accepted or revoked ones are skipped.
- Edge: moving anyone to or from Super admin is only possible one at a time.
- Error: a failed email is listed for that invite.
- Empty: only the Super admin listed means no checkboxes.

### M42-S12 Bulk actions on series (Should)
As an admin, I want to publish, unpublish or delete several series at once, so that housekeeping is quick.
- AC1: Given selected series, When I publish or unpublish, Then each follows the series visibility rule and failures list their reason; Undo is offered.
- AC2: Given selected series, When I delete, Then I must type the count, the dialog says the videos stay as single videos, and no Undo is offered.
- AC3: Given an Editor, When they select series, Then Delete is disabled with "Only an admin can delete a series".
- Edge: delete is page scope only.
- Error: per series failures are listed.
- Empty: "No series yet."

### M42-S13 Restore and delete forever in bulk from Trash (Must)
As an admin, I want to restore or permanently delete many trashed videos, so that Trash does not pile up.
- AC1: Given selected videos in Trash, When I choose Restore, Then they return as Draft with an Undo for 10 seconds that moves them back.
- AC2: Given selected videos, When I choose Delete forever, Then I must type the count to enable the button, and each video is queued for deletion with a result per video.
- AC3: Given an Editor, When they open Trash, Then they can restore but Delete forever is disabled with "Only an admin can delete forever".
- Edge: single Delete forever asks for the word "delete".
- Error: a storage failure on one video retries in the background and is shown as "Queued" with a note.
- Empty: "Trash is empty."

### M42-S14 Upload many files with shared details (Must)
As an admin, I want to set category, series and suitability once for a batch of uploads, so that I do not edit every draft.
- AC1: Given the upload screen, When I add files, Then a details form for all files is shown with Category, Series (with optional numbering in file order), Suitability and Tags.
- AC2: Given I register files, When each draft is created, Then it has the shared details already set.
- AC3: Given I change the shared details, When more files are added, Then new files use the new details and finished ones keep theirs.
- Edge: replacing a failed file never shows the form.
- Error: an invalid choice is explained next to the field and the file waits.
- Empty: before any file is added the form is collapsed with its summary.

### M42-S15 Override details per file (Should)
As an admin, I want to change one file's details without losing the shared ones, so that exceptions are easy.
- AC1: Given files in the batch, When the override table shows, Then each row has Title, Category, Series and episode, Suitability and Reset.
- AC2: Given I change a cell, When it differs from the shared value, Then it shows a Custom badge and later changes to the shared form do not overwrite it.
- AC3: Given I press Reset, When pressed, Then the cell returns to the shared value.
- Edge: after a file is registered its cells are read only.
- Error: an empty title is not accepted.
- Empty: no files means no table.

### M42-S16 Publish later on upload (Could)
As an admin, I want a batch to publish itself when it is ready, so that I am not waiting by the screen.
- AC1: Given I choose "Publish when ready" with an optional not before time, When the video's last blocker clears, Then it publishes if the time has passed and the publish checklist passes.
- AC2: Given captions are not approved, When the time comes, Then the video stays a draft and I get a notice saying why; the caption gate is never skipped.
- AC3: Given I publish by hand, When it happens, Then the intent is cleared.
- Edge: the video editor shows "Will publish when ready" with Cancel.
- Error: a failed automatic publish leaves a draft and a notice.
- Empty: the default is Keep as draft.

### M42-S17 Captions available switch per video (Must)
As an admin, I want to choose whether viewers get captions on a video, so that a title where captions do not fit can go out without them.
- AC1: Given a video, When I open "Captions for viewers", Then I can choose Follow site default (it shows what that is now), On, or Off.
- AC2: Given I choose Off, When I save, Then I must give a reason of 5 or more characters, viewers get no caption tracks and no CC button for it, and an audit row records the reason.
- AC3: Given Off, When the video is published, Then the caption gate counts it as satisfied and the video publishes without approved captions.
- AC4: Given On or Follow with captions in place, When I switch back, Then approved tracks are offered again without reprocessing.
- Edge: Editors see the switch disabled with "Only an admin can change this".
- Error: save failure keeps the old value and shows retry.
- Empty: not applicable.

### M42-S18 Site default for captions (Should)
As a Super admin, I want one site wide default for caption availability, so that I do not set it on every video.
- AC1: Given Site settings, When I open "Captions are available to viewers by default", Then I see On (the default) or Off, changeable only by a Super admin.
- AC2: Given the default is Off, When a video follows the default, Then viewers get no captions for it, and videos set to On still do.
- AC3: Given I change it, When saved, Then an audit row records the old and new value and the Videos list shows the effective state per video.
- Edge: changing the default does not touch videos set explicitly.
- Error: save failure keeps the old value.
- Empty: not applicable.

### M42-S19 Captions available in bulk (Should)
As an admin, I want to switch captions on or off for many videos, so that a whole season is quick to set.
- AC1: Given selected videos, When I choose Captions for viewers and then On, Off or Follow site default, Then it applies to each with a report; Off asks for one reason applied to all.
- AC2: Given I select all that match my filter, When I use this action, Then up to 500 are changed, because the change is reversible; Undo restores each video's previous value.
- AC3: Given an Editor, When they select videos, Then the action is disabled with the reason.
- Edge: videos in Trash are not included.
- Error: per video failures are listed.
- Empty: not applicable.

### M42-S20 Viewer CC follows availability and is remembered per profile (Must)
As a viewer, I want the CC button only when there are captions, and my choice remembered, so that it just works.
- AC1: Given captions are switched off or there is no approved track, When the player loads, Then there is no CC button and the C key does nothing.
- AC2: Given I turn captions on for my profile, When I watch another video that has captions, Then they are on, on every device I use that profile on.
- AC3: Given I watch a video without captions, When I move on, Then my saved choice is unchanged.
- AC4: Given a kids profile, When a video has captions, Then they start on; with none, nothing shows.
- Edge: title cards hide the CC badge when captions are switched off.
- Error: a caption file failing to load shows the existing toast and playback continues.
- Empty: not applicable.

### M42-S21 Videos list bulk gaps (Must)
As an admin, I want the Videos bulk bar to meet the same rules as every other list, so that big clean ups are safe.
- AC1: Given 5 or more videos are selected, When I choose Move to Trash, Then I must type the count.
- AC2: Given Publish, When I choose it, Then a confirm shows the count and the first blocker for any video that is not ready, before anything changes.
- AC3: Given I choose Remove from category, When it runs, Then it removes where present and reports the rest as skipped.
- AC4: Given a partial result, When shown, Then I can retry the failed ones (M16-S09 AC2).
- Edge: Add and Remove category, Set suitability and Captions for viewers allow Select all that match.
- Error: a thrown error says "Nothing was changed".
- Empty: not applicable.

### M42-S22 Bulk actions are audited (Must)
As the owner, I want every bulk action in the audit log, so that I can answer who changed what.
- AC1: Given any bulk run, When it finishes, Then one `bulk.run` row records the action, the actor, the counts and the first 50 ids, and every changed item has its normal audit row carrying the same bulk id.
- AC2: Given a denied or forged run, When the server refuses, Then an audit row with outcome denied is written.
- AC3: Given the Audit log screen, When I search a bulk id, Then I see the summary and its item rows.
- Edge: the summary never stores reasons typed for individual accounts beyond the shared reason; email addresses are masked as everywhere else.
- Error: if the summary cannot be written the action still completes and the failure is logged and alerted (M24).
- Empty: not applicable.

## M40 Guest access

### M40-S01 Browse and search without an account (Must)
As a visitor, I want to browse and search without signing up, so that I can see what the site offers before I decide anything.
- AC1: Given I have no account, When I open `/`, Then I see the hero and rows (not a sign in card), the same layout an account holder sees without personal rows.
- AC2: Given I am a guest, When I open Browse, a category or Search, Then results load and I can open any title.
- AC3: Given I am a guest, When I open a personal page (`/profiles`, `/account`), Then I go to sign in with the path kept in `next`, and when I open `/my-list` I see the explainer (M40-S08).
- Edge: a guest sees the general audience unless Kids mode is on (M40-S09). Guest search saves nothing on the server and shows no recent searches.
- Error: a failed load shows the normal retry card and the header stays usable. A rate limited search shows "Slow down a little" with a countdown (M06-S10).
- Empty: with no published titles the page shows "New videos are on the way" (M05-S07).

### M40-S02 Play without an account (Must)
As a visitor, I want to press Play and watch, so that nothing stands between me and the video.
- AC1: Given I have no account, When I press Play on a title, series, hero or card, Then playback starts exactly as for an account holder, with no sign in step.
- AC2: Given I press Play, When the server sees no account session, Then it issues a guest playback token (30 minutes, `pid` null, `gst` set) for a published video and the player loads the playlist, key and segments as usual.
- AC3: Given I am a guest, When the token nears expiry or a segment URL expires, Then the player refreshes through a new session without an error (M08-S21).
- AC4: Given the owner has switched guest play off, When I press Play, Then I see "Sign in to watch" with Sign in and Create account, and `next` returns me to the title.
- Edge: a signed in account always takes priority over a guest cookie. Staff previews are unchanged.
- Error: a draft, deleted or unknown video is "This video is not available" (404). A limit hit shows the wait message (M40-S11). A failure to start shows "We could not start this video. Try again" with Retry.
- Empty: not applicable.

### M40-S03 Guest identity cookie (Must)
As the owner, I want a guest to be recognisable only as much as playback needs, so that limits work without collecting personal data.
- AC1: Given a guest presses Play for the first time, When the session route answers, Then it sets one cookie `__Host-ad_guest` (HttpOnly, SameSite Lax, Secure, Path `/`, 180 days) holding a random 128 bit id and a signature.
- AC2: Given the cookie exists and verifies, When the guest plays again, Then no new cookie is set.
- AC3: Given the cookie is forged, truncated or signed with another key, When the guest plays, Then it is treated as absent and a new one is issued.
- AC4: Given a guest only browses, When pages load, Then no guest cookie is set.
- Edge: the id is never shown, never stored with a name or email, and the account id and guest id are different spaces.
- Error: cookies blocked means each play mints a new id, limits then fall back to the IP subject and playback still works.
- Empty: not applicable.

### M40-S04 Guest progress on this device (Must)
As a guest, I want my place remembered, so that I can come back and resume.
- AC1: Given I watch as a guest, When progress is due (M08-S16), Then it is written to this device only, under one storage key, and no request goes to `/api/progress`.
- AC2: Given I open a video I watched before, When the page loads, Then playback resumes at position minus 3 seconds with the usual toast (M08-S15).
- AC3: Given the store holds 100 titles, When I watch a new one, Then the least recently watched entry is dropped.
- AC4: Given the stored data is corrupt, When the page loads, Then it is treated as empty and playback starts at 0.
- Edge: a finished video shows Watch again. Progress is per browser and per device, never shared across devices for guests.
- Error: blocked or full storage never stops playback. A small note says "Your place is not being saved on this device" once per visit (S89).
- Empty: no saved place means playback starts at 0.

### M40-S05 Title and series pages for guests (Must)
As a guest, I want a full title page with a Play button, so that I can decide and watch from one place.
- AC1: Given I open `/title/<slug>` as a guest, When it loads, Then I see poster, title, duration, categories, description, caption badge, Play (or Resume 2:14 from this device) and My List.
- AC2: Given I open `/series/<slug>`, When it loads, Then I see the episode list with progress from this device and the primary button says "Resume S1 E3" or "Play S1 E1".
- AC3: Given the page is shared, When someone opens the link, Then Open Graph tags show the title and picture and search engines may index the page.
- Edge: an old slug redirects as today. Guest play switched off shows the public preview with Sign in to watch (M07-S06).
- Error: not found shows the 404 page. In Kids mode a non-kid title shows "This video is not in Kids mode" with Turn off Kids mode and Browse (M40-S09).
- Empty: a series with no published episode is a 404.

### M40-S06 Signed out header and navigation (Must)
As a guest, I want the same navigation as everyone else plus a clear way to sign in, so that I can move around and join when I want.
- AC1: Given I am signed out on desktop, When any page loads, Then the header shows logo, Home, Browse, My List, search and a Sign in button, plus Create account when sign up is open.
- AC2: Given I am signed out on a phone, When any page except the watch page loads, Then I see the top bar with logo, search icon and Sign in, and the bottom tab bar with Home, Browse, Search and My List.
- AC3: Given I open the menu, When it shows, Then it holds Kids mode, Data saver, Help, Sign in and Create account (when open).
- Edge: Sign in keeps the current path in `next`. The profile picker is never shown to a guest. Create account is hidden when sign up is closed.
- Error: not applicable.
- Empty: not applicable.

### M40-S07 Sign in to save (Must)
As a guest, I want a clear, short prompt when I try to save something, so that I understand why an account is needed and can say no.
- AC1: Given I am a guest, When I tap My List on a card, title, series or watch page, Then a dialog (bottom sheet on a phone) opens titled "Save this to My List" with Sign in, Create account and Not now, and nothing is stored.
- AC2: Given the dialog is open, When I press Escape, tap Not now or tap outside, Then it closes, focus returns to the button and I keep watching or browsing.
- AC3: Given I choose Sign in or Create account, When I leave, Then `next` holds the current path and the pending action is remembered for 30 minutes.
- AC4: Given likes exist (lane L5), When a guest likes a title, Then the same dialog opens with the like wording.
- Edge: Create account is hidden when sign up is closed. The button has no pressed state for guests.
- Error: not applicable. The dialog does no network call.
- Empty: not applicable.

### M40-S08 My List explainer for guests (Must)
As a guest, I want `/my-list` to explain itself, so that I am not thrown to a sign in page.
- AC1: Given I open `/my-list` as a guest, When it loads, Then I see "My List" and "Save videos to watch later", one sentence ("Sign in or create a free account to keep a list that follows you on every device."), a Sign in button, a Create account button and a Browse videos link.
- AC2: Given I have progress on this device, When the page loads, Then a link to Continue Watching on Home is shown.
- Edge: Create account is hidden when sign up is closed.
- Error: not applicable.
- Empty: this is the empty state.

### M40-S09 Guest audience and Kids mode toggle (Must)
As a parent sharing a device, I want a Kids mode switch for visitors, so that the screen shows videos made for children.
- AC1: Given I am a guest and the site default is general, When I switch Kids mode on, Then Home, Browse, Search, up next and related show only kid suitable titles at once, enforced in the query, and the header shows only the logo mark (R17).
- AC2: Given Kids mode is on, When a direct link to a non-kid title opens, Then I see "This video is not in Kids mode" with Turn off Kids mode and Browse, and no playback session is issued.
- AC3: Given I switch Kids mode off, When I confirm, Then no password is asked and everything returns to general.
- AC4: Given the device has made no choice, When I open the site, Then the site setting `guestAudience` decides.
- AC5: Given I select a kids profile while signed in, When I later lose my session, Then this device stays in Kids mode until it is switched off.
- Edge: the switch is a convenience, not a lock. Its help text says "Shows videos made for children. Anyone using this device can turn it off." Copy never says locked or safe. A guest in Kids mode stores no analytics identity.
- Error: a failure to save the choice shows "We could not change Kids mode. Try again." and keeps the old state. A filter failure returns an empty list, never an unfiltered one.
- Empty: with no kid titles Home shows "Nothing here yet. Ask a grown-up to turn off Kids mode."

### M40-S10 Guest settings the owner controls (Must)
As the owner, I want to choose what visitors see and whether they can watch without an account, so that I stay in control.
- AC1: Given Settings, Features, When I open it, Then I see "Default for visitors without an account" (General or Kids, default General) and "Guests can watch" (default on), with the plain descriptions from the registry.
- AC2: Given `client.json` has `guestAudience` and `guestPlay`, When I run `pnpm launch:apply`, Then the settings take those values, and a second run reports unchanged.
- AC3: Given guest play is switched off, When a guest presses Play, Then they see Sign in to watch (M40-S02 AC4), while browsing still works.
- Edge: both settings are Super admin only for guest play and Admin for the audience, and every change is audited.
- Error: an invalid value is refused with the field named.
- Empty: not applicable.

### M40-S11 Guest abuse protection (Must)
As the owner, I want guest playback limited, so that open access does not become an open tap.
- AC1: Given a guest id mints more than 20 sessions in a minute, When the next arrives, Then it returns 429 with Retry-After and the player shows a plain wait message.
- AC2: Given an IP mints more than 120 guest sessions in a minute, When the next arrives, Then it returns 429 (generous because mobile networks share addresses).
- AC3: Given a guest token, When segment URLs are issued, Then they expire in 20 minutes (setting `limits.guest_segment_minutes`), while account URLs last 2 hours.
- AC4: Given key requests from one guest exceed 20 per 10 minutes or from one IP exceed 300 per minute, When exceeded, Then 429.
- Edge: refused requests write a log line with route, status, video id and IP, never a token or cookie.
- Error: a limiter store failure follows the documented rule in M23-S03 AC2 and is logged.
- Empty: not applicable.

### M40-S12 Challenge after repeated limits (Should)
As the owner, I want a human check after repeated abuse, so that real viewers are not blocked.
- AC1: Given an IP hits the guest limits 3 times in 10 minutes and Turnstile is configured, When the next session is requested, Then it answers `challenge_required` and the player shows a short check.
- AC2: Given the viewer passes the check, When the session is retried, Then playback starts.
- AC3: Given Turnstile keys are absent, When the limits are hit, Then only the 429 wait applies.
- Edge: the check never appears for a normal viewer. Kids playback pages follow SECURITY.md section 12 (no third party script) so the check there is replaced by the wait message.
- Error: check failure shows "We could not confirm you are human. Try again."
- Empty: not applicable.

### M40-S13 Move device history into my account (Should)
As a guest who just signed in, I want my watched videos added to my profile, so that I do not lose my place.
- AC1: Given I sign in, pick a non-kids profile and this device holds guest progress, When the page loads, Then a dialog asks "Add the 6 videos you watched on this device to your profile?" with Add them and No thanks.
- AC2: Given I choose Add them, When the import runs, Then at most 100 entries are sent, only missing or older server rows are filled, newer server data is never overwritten, and I see "Added 6 videos to Continue Watching".
- AC3: Given I choose Not now, When I dismiss, Then the device does not ask again during this visit and the guest data stays.
- AC4: Given the profile is a kids profile, When Home loads, Then no prompt shows.
- Edge: videos no longer available are skipped, and the toast counts what was added. Imported entries are removed from the device store only after the server accepted them. The prompt is asked once per visit while history remains on the device (D-237).
- Error: failure shows "We could not add them. Try again." with Retry, and nothing is removed.
- Empty: with no device progress there is no prompt.

### M40-S14 Continue Watching for guests (Should)
As a guest, I want Continue Watching on Home, so that I get back to what I was watching.
- AC1: Given I have unfinished progress on this device, When Home loads, Then a Continue Watching row shows up to 20 titles with progress bars, in the same place accounts see it.
- AC2: Given I remove an item, When I confirm, Then it leaves the row at once with an Undo toast for 6 seconds.
- AC3: Given a title was unpublished or is not allowed in Kids mode, When the row loads, Then it is dropped and removed from the device store.
- Edge: the row is hidden when empty.
- Error: a failed lookup hides the row and never blocks the rest of Home.
- Empty: the row is not rendered.

### M40-S15 Finish a save after sign in (Should)
As a guest who chose to sign in to save, I want the save to happen, so that I do not repeat myself.
- AC1: Given I opened the dialog on a title and signed in, When I land back on that title with a profile, Then the title is added to My List and "Added to My List" shows.
- AC2: Given more than 30 minutes passed, When I land, Then nothing is added.
- AC3: Given the title is not allowed for the chosen profile, When I land, Then nothing is added and no error shows.
- Edge: the pending action is held in this browser's local storage for 30 minutes, holds one wish, is checked on read and cleared after use. It is written only when the visitor follows Sign in or Create account from the dialog (D-235).
- Error: a failed add shows the standard My List error toast (M10-S01 AC2).
- Empty: not applicable.

### M40-S16 Guest analytics and privacy (Must)
As a viewer, I want guest analytics to stay anonymous, so that I am not tracked.
- AC1: Given a guest plays a video, When events are recorded, Then the stored viewer id is a hash of the guest id and the day, so it changes daily and the guest id itself is not stored.
- AC2: Given a guest is in Kids mode, When events are recorded, Then no viewer id is stored.
- AC3: Given the Privacy page, When viewed, Then it names the guest cookie, its purpose (limits and playback) and its life (180 days), and the anonymous daily id.
- Edge: no third party scripts. Clearing cookies makes the next day count as a new viewer, which is accepted.
- Error: an analytics failure never affects playback (M19-S01).
- Empty: not applicable.

### M40-S17 Search engines can see public pages (Should)
As the owner, I want titles to be found on search engines, so that more people arrive.
- AC1: Given a crawler requests `/robots.txt`, When it answers, Then it allows `/`, `/title/`, `/series/` and `/browse` and disallows `/api/`, `/admin`, `/account`, `/profiles`, `/settings`, `/watch/`, `/search`, `/my-list`, `/sign-in` and `/sign-up`.
- AC2: Given a crawler opens a title page, When it loads, Then the page has real content, a canonical URL and Open Graph tags.
- AC3: Given a watch page, When it loads, Then it is marked noindex.
- Edge: the sitemap and structured data belong to lane L6. The `Sitemap:` line is added only when the sitemap exists.
- Error: not applicable.
- Empty: not applicable.

### M40-S18 Clear history on this device (Could, not built)
As a guest on a shared device, I want to clear what this device remembers, so that others do not see my history.
- AC1: Given I open the menu, When I choose Clear history on this device, Then a confirm asks "Clear history on this device? This removes your places and Continue Watching here. This cannot be undone." with Clear history and Keep it.
- AC2: Given I confirm, When it finishes, Then the guest progress, the import answer and Kids mode choice for this device are removed and a toast confirms.
- Edge: signed in accounts see Sign out instead.
- Error: failure shows an error toast and keeps the data.
- Empty: with no history the item is hidden.

## Coverage summary

Total stories: 311. Must: 199. Should: 89. Could: 23.

| Module | Stories |
|---|---|
| M01 | 14 |
| M02 | 8 |
| M03 | 14 |
| M04 | 5 |
| M05 | 8 |
| M06 | 10 |
| M07 | 7 |
| M08 | 31 |
| M09 | 10 |
| M10 | 6 |
| M11 | 7 |
| M12 | 9 |
| M13 | 12 |
| M14 | 9 |
| M15 | 11 |
| M16 | 11 |
| M17 | 7 |
| M18 | 9 |
| M19 | 7 |
| M20 | 5 |
| M21 | 5 |
| M22 | 3 |
| M23 | 5 |
| M24 | 4 |
| M25 | 7 |
| M26 | 6 |
| M27 | 4 |
| M28 | 6 |
| M29 | 4 |
| M30 | 4 |
| M31 | 4 |
| M32 | 4 |
| M33 | 3 |
| M34 | 4 |
| M35 | 4 |
| M36 | 4 |
| M40 | 18 |
| M41 | 22 |

Modules with no viewer or admin screen of their own (M04, M22, M23, M24, M30, M31, M33) still carry stories because their behaviour is testable and has user visible effects.

## M47 Design system tuning and guards

### M47-S01 Next card peeks at every width (Must)
As a viewer on any screen, I want to see part of the next card in every row, so that I know the row scrolls.
- AC1: Given a row on a container 360 px wide, When it renders, Then 2.3 cards are visible and the next card is partly shown.
- AC2: Given container widths 600, 960, 1280 and 1920 px, When the row renders, Then 3.3, 4.3, 5.3 and 6.3 cards are visible.
- AC3: Given the row sits in a narrower container (for example a split layout), When it renders, Then the count follows the container, not the viewport.
- AC4: Given the skeleton row, When it shows, Then card width and gutters equal the real row (no layout shift when content arrives).
- Edge: a row with fewer cards than fit shows them left aligned without arrows. Browsers without container queries use the viewport values.
- Error: not applicable.
- Empty: a row with no cards is hidden (My List shows its empty state).

### M47-S02 Hover only where hover exists (Must)
As a phone user, I want no sticky hover states, so that taps do not leave things highlighted or moved.
- AC1: Given any stylesheet, When scanned in CI, Then every `:hover` rule sits inside `@media (hover: hover)`.
- AC2: Given a rule that scales, moves or reveals, When scanned, Then it sits inside `(hover: hover) and (pointer: fine)`.
- AC3: Given a touch device, When I tap a card, Then no hover card, lift or reveal appears and the card opens.
- Edge: hybrid devices (laptop with touch) use the fine pointer rules while the mouse is the primary pointer.
- Error: CI fails with the file and line of the rule.
- Empty: not applicable.

### M47-S03 Hover card (Should)
As a desktop viewer, I want a quick preview of a title when I rest the mouse on it, so that I can decide without opening it.
- AC1: Given a fine pointer, When I rest on a card for 300 ms, Then the card scales to 1.25 over 250 ms with a strong ease out and shows title, length, subject and Play.
- AC2: Given I move the pointer away, When it leaves, Then the card returns immediately with no delay.
- AC3: Given the first card of a row, When it scales, Then it grows from the left edge. Given the last card, Then from the right edge. Others grow from the centre.
- AC4: Given the card scales, When it overlaps neighbours, Then it sits above them and is never clipped by the row.
- AC5: Given keyboard focus on a card, When focus-within applies, Then the same content shows without scale.
- AC6: Given reduced motion, When I hover, Then there is no scale and no delay, and the content shows at once.
- Edge: no video preview, ever. Title is read once by screen readers (the preview is `aria-hidden`).
- Error: not applicable.
- Empty: a card without a description shows title, length and Play only.

### M47-S04 Nav that turns solid on scroll (Must)
As a viewer, I want the top bar to stay readable over the hero and solid once I scroll, so that links are always legible.
- AC1: Given the Home page at the top, When it loads, Then the nav is clear over the hero scrim with white text.
- AC2: Given I scroll more than 40 px, When the sentinel leaves the viewport, Then the nav fades to the surface colour with ink text over 200 ms.
- AC3: Given a page restored scrolled, When it loads, Then the nav is already solid.
- AC4: Given a non hero page, When it loads, Then the nav is always solid.
- AC5: Given no IntersectionObserver, When the page loads, Then the nav is solid.
- Edge: nav height is 3.5 rem on phones and 4.25 rem from 960 px, in the same place in both states (no jump).
- Error: not applicable.
- Empty: not applicable.

### M47-S05 Row arrows and native scrolling (Must)
As a mouse user, I want arrows on a row, and as a touch user I want to swipe, so that both feel natural.
- AC1: Given a fine pointer, When I hover or focus inside a row, Then prev and next arrows appear centred on the thumbnails; the prev arrow is hidden at the start and the next at the end.
- AC2: Given I press an arrow, When the row pages, Then it moves one visible page minus one card, and focus stays on the arrow.
- AC3: Given reduced motion, When I page, Then the row jumps without smooth scrolling.
- AC4: Given a touch device, When I swipe, Then scrolling is native, snaps to a card start when near one, and the page does not scroll sideways.
- Edge: arrow targets are 44 px. Arrow keys are not hijacked.
- Error: not applicable.
- Empty: a row with all cards visible shows no arrows.

### M47-S06 Focus rings that always show and pass contrast (Must)
As a keyboard user, I want a visible ring on every focusable thing, so that I never lose my place.
- AC1: Given the profile picker, When a tile takes keyboard focus, Then a 3 px ring with a 3 px gap draws around the avatar with at least 3 to 1 contrast against the page.
- AC2: Given a card link, When focused, Then the ring draws around the thumbnail with a 2 px offset.
- AC3: Given Windows forced colors, When a tile or card is focused, Then the ring uses the system highlight colour.
- AC4: Given the default theme and every preset, When CI computes ring contrast, Then it is at least 3 to 1 against each adjacent colour.
- Edge: no component sets `outline: none` without a replacement ring (programmatic focus landmarks excepted).
- Error: CI names the selector.
- Empty: not applicable.

### M47-S07 Motion tokens and reduced motion (Must)
As a viewer who prefers less motion, I want movement removed everywhere, so that the site is comfortable.
- AC1: Given hover on desktop, When a control changes, Then it uses 250 ms with a strong ease out, and press uses 0 ms.
- AC2: Given `prefers-reduced-motion: reduce`, When any page loads, Then transitions and animations are near zero, hover cards do not scale, the hero does not crossfade or rotate, skeletons are static and rows jump instead of gliding.
- AC3: Given Data saver is on, When pages load, Then slow transitions are also removed.
- AC4: Given a stylesheet, When scanned, Then only transform, opacity and colour properties transition (progress width excepted).
- Edge: nothing flashes more than 3 times a second.
- Error: CI names the rule.
- Empty: not applicable.

### M47-S08 Button size tokens with 44 px targets (Should)
As a viewer, I want buttons that look tidy on desktop and are easy to press on a phone.
- AC1: Given a fine pointer, When a small, medium or large button renders, Then it looks 2, 2.5 or 3 rem tall and its tap area is still 44 px.
- AC2: Given a touch device, When any button renders, Then it is at least 44 px tall.
- AC3: Given two buttons side by side, When they render, Then their hit areas do not overlap (8 px between).
- Edge: icon only buttons are 44 by 44.
- Error: not applicable.
- Empty: not applicable.

### M47-S09 One type scale for docs and code (Must)
As a phone user, I want headings sized for a small screen, so that titles do not wrap into narrow columns.
- AC1: Given a viewport under 960 px, When pages render, Then H1 to lead are 28, 24, 20, 18 and 17 px.
- AC2: Given 960 px and above, When pages render, Then they are 40, 32, 24, 20 and 18 px.
- AC3: Given the hero title, When the viewport changes, Then it scales between 2 and 3.5 rem with `clamp(2rem, 5vw, 3.5rem)`.
- AC4: Given the admin base size factor 0.9 to 1.15, When set, Then all sizes scale and the layout survives 200 percent zoom.
- Edge: avatar initials do not follow the hero size.
- Error: not applicable.
- Empty: not applicable.

### M47-S10 Hero crossfade, rotation and readable text (Must)
As a viewer, I want the hero to change gently and always keep its text readable.
- AC1: Given several hero titles, When I wait, Then they rotate every 20 seconds with a 350 ms crossfade, a visible Pause control and dots.
- AC2: Given I hover, focus, touch or press Pause, When it happens, Then rotation stops.
- AC3: Given reduced motion or Data saver, When Home loads, Then the hero does not rotate and does not crossfade.
- AC4: Given any hero image, When the title shows, Then white text on the scrim is at least 4.5 to 1 against the lightest possible image.
- Edge: one title never rotates and has no dots. The hero is a still image (no video).
- Error: a missing image falls back to a solid primary panel with the title.
- Empty: no hero items hides the hero.

### M47-S11 Yoruba and Igbo letters in every font (Must)
As a Yoruba or Igbo speaker, I want my letters shown properly, so that titles and captions are correct.
- AC1: Given any of the six fonts, When text has `ọ ẹ ṣ ń ị ụ` and capitals, Then they render in the chosen font.
- AC2: Given the theme editor, When staff pick a font, Then the sample line shows these letters.
- AC3: Given CI, When fonts change, Then a coverage test lists any missing glyph by family.
- Edge: the naira sign falls back to the system font for fonts that do not carry it.
- Error: CI names family and glyph.
- Empty: not applicable.

### M47-S12 Skeletons that match the real layout (Must)
As a viewer on a slow network, I want placeholders the same size as the content, so that nothing jumps.
- AC1: Given a loading row, When the skeleton shows, Then each card matches width, 16:9 thumb, two title lines and a meta line of the real card.
- AC2: Given a wait under 300 ms, When it ends, Then no skeleton flashes.
- AC3: Given content arrives, When it replaces the skeleton, Then it appears in one step with no shift (CLS under 0.1).
- AC4: Given reduced motion, When a skeleton shows, Then it is a static fill with a hidden "Loading" label and `aria-busy`.
- Edge: a failed load shows the error state, never a skeleton.
- Error: not applicable.
- Empty: not applicable.

### M47-S13 One sentence, one action (Should)
As a viewer, I want clear messages when there is nothing to show or something fails, so that I know what to do.
- AC1: Given an empty state, When it shows, Then it has a headline, one sentence and one action.
- AC2: Given an error, When it shows, Then it says what happened and what to do next, with a reference code only in small text.
- AC3: Given any copy, When scanned in CI, Then it has no dashes, emojis or exclamation marks.
- Edge: row errors show "Could not load this row. Try again." and the other rows continue.
- Error: the error state is the story.
- Empty: My List empty says "Your list is empty." with "Browse videos".

### M47-S14 Bottom tab bar on phones (Should)
As a phone user, I want the main places one thumb away, so that I can move around easily.
- AC1: Given a phone width, When any viewer page shows, Then a 4 item bar (Home, Browse, Search, My List) sits at the bottom with the safe area inset, the current item marked by colour and a 3 px top bar.
- AC2: Given the title page or the watch page, When it shows, Then the bar is hidden.
- AC3: Given 960 px and wider, When pages show, Then the bar is hidden and the top nav shows the links.
- AC4: Given content near the page end, When I scroll, Then the footer clears the bar by exactly the bar height.
- Edge: a guest sees the same bar (no sign in wall, per the guest program).
- Error: not applicable.
- Empty: not applicable.

### M47-S15 Docs, decisions and guards stay in step (Must)
As the developer, I want docs and code to fail a check when they drift, so that the design system stays true.
- AC1: Given a number in DS sections 5, 6 or 8, When it differs from tokens.css, Then CI fails.
- AC2: Given `docs/DECISIONS.md`, When a new duplicate id is added, Then CI fails. The four known pairs are listed in a register.
- AC3: Given `ai-context.md`, When it quotes a decision number, Then it equals the highest heading.
- AC4: Given a new interactive class, When it has no touch target or focus ring rule, Then CI fails.
- Edge: allowlists carry a reason comment.
- Error: CI prints the file, line and rule.
- Empty: not applicable.

### M47-S16 Night theme preset (Could)
As the owner, I want an optional dark theme, so that the platform can look cinematic if the client prefers.
- AC1: Given the theme editor, When I pick Night, Then the colours fill and pass the contrast gate.
- AC2: Given Night is saved, When pages render, Then nav, cards, hero and player stay readable and focus rings use the dark ring.
- Edge: the default stays Default (off white).
- Error: a failing pair blocks save with the reason.
- Empty: not applicable.

## M48 Sponsors and donations (44 stories)

Off by default. Never shown to kids profiles or Kids mode. Priorities follow `docs/plan/v2/L9-monetization.md` section 7.

### M48-S01 Master and placement switches (Must)
As an admin, I want one master switch and a switch per placement, so that sponsors never appear until I decide.
- AC1: Given a fresh install, When I open Settings, Monetization, Then sponsors and every placement are off and the page says nothing is shown to viewers.
- AC2: Given the master switch is on and Home banner is off, When a viewer opens Home, Then no sponsor markup exists in the page.
- AC3: Given I turn the master switch on or off, When I save, Then I am asked for my password (reauth), and an audit row is written.
- Edge: turning the master switch off hides the Sponsors nav entry badge but keeps data.
- Error: if saving fails, the toggle returns to its previous state with a message.
- Empty: with the master switch on and no live sponsor, the admin sees "Nothing is showing yet" and a Create sponsor button.

### M48-S02 Create a sponsor (Must)
As an admin or editor, I want to create a sponsor with a name, optional contact and notes, so that I can organise campaigns.
- AC1: Given I open Sponsors, New, When I enter a name and save, Then a sponsor is created as draft.
- AC2: Given the name is empty or over 80 characters, When I blur the field, Then an inline error appears with `aria-invalid`.
- AC3: Given I enter a contact email, When it is saved, Then it is stored encrypted and shown masked.
- Edge: duplicate names are allowed but warned.
- Error: network failure keeps my entries.
- Empty: the list shows an explanation and a Create button.

### M48-S03 Upload a creative (Must)
As an editor, I want to add a creative (headline, short text, button label, square image, optional wide image, alt text), so that the sponsor card looks right.
- AC1: Given I upload a square image of at least 400 px and under 2 MB, When it processes, Then I see WebP and AVIF variants and a preview per placement.
- AC2: Given I upload a wrong type, too small or too large file, When I submit, Then a plain error says what to fix.
- AC3: Given the creative has an image, When I leave alt text empty, Then I must tick "decorative" or enter text.
- Edge: creative with no image renders as a text card.
- Error: processing failure shows Retry and keeps the draft.
- Empty: "No creatives yet" with an Add creative button.

### M48-S04 Destination link validation (Must)
As an admin, I want the link checked, so that viewers are never sent somewhere unsafe.
- AC1: Given I enter a destination, When I save, Then only https URLs without credentials are accepted.
- AC2: Given the host is localhost, a private IP or our own site, When I save, Then it is rejected with an explanation.
- AC3: Given a valid link, When I preview, Then the preview opens it in a new tab and does not count a click.
- Edge: tracking parameters (utm) are kept as typed.
- Error: invalid URL shows an inline error.
- Empty: not applicable.

### M48-S05 Schedule start and end (Must)
As an admin, I want start and end dates, so that a campaign runs only when agreed.
- AC1: Given I set start 1 December and end 31 December, When it is 30 November, Then status is Scheduled and nothing shows.
- AC2: Given the end date has passed, When a viewer loads Home, Then the sponsor does not show even if the worker is down.
- AC3: Given the end is before the start, When I save, Then an inline error appears.
- Edge: dates are in Lagos time, the end date is inclusive to 23:59:59.
- Error: invalid date text is rejected.
- Empty: no dates means it runs until paused.

### M48-S06 Choose placements per creative (Must)
As an admin, I want to tick which placements a creative may use, so that a sponsor can be limited to Home only.
- AC1: Given a creative, When I tick Home banner and Title card, Then only those slots can select it.
- AC2: Given a placement is globally off, When I view the creative, Then that checkbox shows "Off in settings" and a link.
- Edge: no placement ticked means the creative is never shown, the form warns.
- Error: save failure keeps ticks.
- Empty: not applicable.

### M48-S07 Sponsor status lifecycle (Must)
As an admin, I want clear statuses (Draft, Scheduled, Live, Paused, Ended, Archived), so that I know what viewers see.
- AC1: Given any sponsor, When I view the list, Then the status shows as an icon and a word, never colour alone.
- AC2: Given a Live sponsor, When I press Pause, Then it stops showing on the next page load.
- AC3: Given a sponsor has report data, When I try to delete it, Then I can only archive.
- Edge: only admin can move to Live.
- Error: a failed status change shows the old status.
- Empty: filters with no result show "No sponsors in this view".

### M48-S08 Frequency caps (Must)
As an admin, I want caps, so that viewers are not shown the same sponsor too often.
- AC1: Given the home cap is 2 per day, When a browser has seen the sponsor twice today, Then the third Home load shows no banner and no gap.
- AC2: Given the browser cleared cookies, When it loads Home, Then the sponsor may show again (documented limit).
- AC3: Given a cap value outside range, When I save, Then it is rejected.
- Edge: the cap resets at Lagos midnight.
- Error: a corrupted cap cookie is ignored.
- Empty: not applicable.

### M48-S09 Home banner (Must)
As a viewer, I want a sponsor banner between rows that does not disturb browsing, so that I can scroll past it.
- AC1: Given a live sponsor and the Home banner on, When I load Home, Then one banner appears after the configured row.
- AC2: Given the page loads, When the banner renders, Then it occupies its reserved height with no layout shift (CLS 0 from the banner).
- AC3: Given I use the keyboard, When I Tab, Then the banner link is reachable once and has a visible focus ring.
- Edge: with fewer rows than the position, no banner.
- Error: image fails to load, the card shows text with the same height.
- Empty: no live sponsor means no markup.

### M48-S10 Title page card (Must)
As a viewer, I want a small sponsor card on a title page, so that it never covers the video or the Play button.
- AC1: Given a live sponsor with Title card on, When I open a title page, Then the card shows below the action buttons and above More like this.
- AC2: Given I am on a phone, When the page renders, Then the card is full width and Play stays above the fold.
- Edge: series pages use the same slot once.
- Error: image failure falls back to text.
- Empty: no sponsor, no gap.

### M48-S11 Message card after a video (Should)
As a viewer, I want a still sponsor message when a video ends, so that it never interrupts the lesson.
- AC1: Given the video ended and the slot is on, When the end screen shows, Then a card appears next to Up next.
- AC2: Given an Up next countdown is running, When the card shows, Then the countdown is neither paused nor extended.
- AC3: Given I press Next or Replay, When I do, Then the card gets out of the way immediately.
- Edge: not shown when the video was abandoned before the end.
- Error: none beyond image fallback.
- Empty: no sponsor, normal end screen.

### M48-S12 Message card before a video (Should)
As a viewer, I want to skip a sponsor message at once, so that I can start learning without a wait.
- AC1: Given the slot is on and I tap Play on a fresh start, When the card shows, Then a Skip button is visible and focused from the first moment.
- AC2: Given I do nothing, When the configured seconds pass (default 5), Then playback starts.
- AC3: Given the video is loading, When the card shows, Then media requests have already started so the card adds no delay.
- AC4: Given Data saver is on or I resume partway, When I press Play, Then no card shows.
- Edge: Enter, Space and Escape skip. Replay in the same session shows no card.
- Error: card render failure starts playback immediately.
- Empty: no sponsor, normal start.

### M48-S13 Never on kids (Must)
As a parent, I want no sponsor content for children, so that kids are protected.
- AC1: Given a kids profile or Kids mode, When any page loads, Then no sponsor markup, cookie, request or tracking exists.
- AC2: Given someone calls the click or impression route with a kids context, When processed, Then nothing is recorded and 404 or 204 returns.
- AC3: Given site guest audience is Kids, When a guest browses, Then no sponsor shows.
- Edge: switching to Kids mode removes the banner without reload artifacts.
- Error: if audience cannot be determined, treat as kids (fail closed).
- Empty: not applicable.

### M48-S14 Sponsored label (Must)
As a viewer, I want a clear label, so that I can tell a sponsor from lessons.
- AC1: Given any sponsor card, When it renders, Then "Sponsored by NAME" (or the configured wording) shows as text at 13 px or larger with 4.5:1 contrast.
- AC2: Given I use a screen reader, When I reach the card, Then it is announced as sponsored before its content.
- AC3: Given an admin edits the creative, When saving, Then the label cannot be hidden or emptied.
- Edge: label wording options are limited to the allowed set.
- Error: not applicable.
- Empty: not applicable.

### M48-S15 Impression tracking (Must)
As an admin, I want accurate impression counts without third-party tools, so that reports are trustworthy.
- AC1: Given a card is 50 percent visible for 1 second, When tracked, Then one impression is counted for that page view.
- AC2: Given bots, admin previews or kids contexts, When tracked, Then nothing is counted.
- AC3: Given the viewer is offline, When the batch fails, Then it follows the existing analytics retry rules and never blocks the page.
- Edge: tab hidden means no count.
- Error: invalid events are dropped and counted as rejected.
- Empty: not applicable.

### M48-S16 Click tracking (Must)
As an admin, I want clicks counted on our own origin, so that no sponsor script runs.
- AC1: Given I tap a card, When the browser navigates to `/s/{id}`, Then a click is recorded and I land on the sponsor URL.
- AC2: Given someone tampers with the URL, When requested, Then the destination still comes only from the database.
- AC3: Given the sponsor is no longer live, When `/s/{id}` is requested, Then it returns 404.
- Edge: referrer is not sent to the sponsor.
- Error: a recording failure still redirects (the viewer is not punished), and logs a warning.
- Empty: not applicable.

### M48-S17 Data saver and offline (Must)
As a viewer on a slow connection, I want sponsors to cost almost nothing, so that lessons stay fast.
- AC1: Given Data saver is on, When a sponsor shows, Then it is text only, no image is fetched.
- AC2: Given I am offline, When a page loads from the service worker, Then no sponsor request is made and no gap is left.
- AC3: Given Data saver is on, When I press Play, Then no before card shows.
- Edge: the service worker never caches `/s/*`.
- Error: not applicable.
- Empty: not applicable.

### M48-S18 Sponsor report on screen (Must)
As an admin, I want a report per sponsor, so that I can show results.
- AC1: Given a date range, When I open the report, Then I see impressions, clicks, click rate, daily reach, by creative and placement, with a chart that has a text table alternative.
- AC2: Given no data, When I open the report, Then it shows an explanation instead of empty charts.
- AC3: Given the range is over 400 days, When I apply it, Then an inline error appears.
- Edge: reach is labelled "daily reach (not unique people)".
- Error: query failure shows Retry.
- Empty: "No impressions yet. Check the dates and placements."

### M48-S19 CSV export (Should)
As an admin, I want a CSV, so that I can share the numbers.
- AC1: Given a report, When I choose Export CSV, Then a queued export produces a file with fixed columns.
- AC2: Given a cell starts with `=`, `+`, `-` or `@`, When exported, Then it is neutralised.
- AC3: Given I am an editor, When I try, Then access is denied.
- Edge: expires after the export window.
- Error: failed export shows Retry.
- Empty: an empty report exports headers only.

### M48-S20 Printable sponsor summary (Should)
As an admin, I want a one page summary I can send to a sponsor, so that I can save it as PDF.
- AC1: Given a report, When I choose Print summary, Then a clean page shows sponsor, period, totals, per placement table and a methodology note.
- AC2: Given I print, When the browser dialog opens, Then the admin shell is hidden and the page fits A4.
- Edge: uses the site name and logo from settings.
- Error: not applicable.
- Empty: totals show zero with the same note.

### M48-S21 Preview without counting (Must)
As an editor, I want to preview each placement, so that I can check before going live.
- AC1: Given a creative, When I open Preview, Then I see mobile and desktop renderings per slot, including text only mode.
- AC2: Given I click inside the preview, When it navigates, Then nothing is counted.
- Edge: preview works for draft sponsors.
- Error: not applicable.
- Empty: not applicable.

### M48-S22 Rotation (Should)
As an admin, I want several sponsors to share a slot fairly, so that each gets exposure.
- AC1: Given two live creatives for Home, When pages load across days, Then they alternate evenly by day.
- AC2: Given weighted mode, When weights are 3 and 1, Then 3 of 4 days show the first.
- Edge: a capped creative is skipped for that browser.
- Error: not applicable.
- Empty: one creative always shows (within caps).

### M48-S23 Why am I seeing this (Could)
As a viewer, I want a short explanation, so that I understand sponsors fund the platform.
- AC1: Given a card, When I open "Why am I seeing this?", Then `/sponsors` explains sponsors, that they do not get my data, and that kids never see them.
- Edge: page 404s when sponsors are off.
- Error: not applicable.
- Empty: not applicable.

### M48-S24 Donate button and navigation (Must)
As a viewer, I want an easy but unpushy way to give, so that I can support the platform if I wish.
- AC1: Given donations are on, When I view the footer, header menu or end of a video, Then a Donate link shows.
- AC2: Given donations are off, When I request `/donate`, Then it returns 404 and no link exists anywhere.
- AC3: Given Kids mode, When I look, Then no Donate link shows and `/donate` explains "Ask a grown-up".
- Edge: no popups, no banners, no nagging.
- Error: not applicable.
- Empty: not applicable.

### M48-S25 Amount selection (Must)
As a donor, I want presets and a custom amount, so that I can give what I choose.
- AC1: Given NGN presets, When I tap one, Then it shows as pressed and the button shows the amount.
- AC2: Given I type a custom amount below the minimum or above the maximum, When I leave the field, Then an inline message states the limit.
- AC3: Given I use a phone, When I focus the field, Then the numeric keypad opens.
- Edge: the amount is validated again on the server.
- Error: failure keeps my input.
- Empty: not applicable.

### M48-S26 One time donation with Paystack (Must)
As a donor, I want to pay by card, bank transfer or USSD on a secure page, so that my payment details stay safe.
- AC1: Given I enter an amount and email and press Donate, When the server creates the transaction, Then I am sent to Paystack's hosted page.
- AC2: Given I pay, When Paystack redirects me back, Then I land on the thank you page.
- AC3: Given I close the Paystack page, When I return, Then I see the cancelled page with a way to try again.
- Edge: double tapping creates one transaction.
- Error: if Paystack is unreachable, "We could not start the payment. Nothing was charged. Try again." and no stuck row.
- Empty: not applicable.

### M48-S27 Webhook signature verification (Must)
As the owner, I want only genuine Paystack events accepted, so that nobody can fake a donation.
- AC1: Given a request with a missing or wrong `x-paystack-signature`, When it arrives, Then it gets 401 and nothing is stored or enqueued.
- AC2: Given a correct signature over the raw body, When it arrives, Then it is stored and acknowledged within one second.
- AC3: Given a body changed by one byte, When it arrives with the old signature, Then it is rejected.
- Edge: oversized bodies are rejected before hashing.
- Error: processing errors never change the response to Paystack after storage.
- Empty: not applicable.

### M48-S28 Idempotent processing (Must)
As the owner, I want repeated or out of order events to be harmless, so that no donor is charged twice in our books or emailed twice.
- AC1: Given the same event is delivered twice, When processed, Then one state change and one receipt result.
- AC2: Given a success event arrives before our row is visible, When processed, Then it is retried, not dropped.
- AC3: Given the paid amount is lower than expected, When processed, Then the donation is flagged needs review and no receipt is sent.
- Edge: concurrent deliveries are serialised by reference.
- Error: poison events end in a failed state with an alert in the admin.
- Empty: not applicable.

### M48-S29 Thank you page (Must)
As a donor, I want an honest confirmation, so that I know the gift arrived.
- AC1: Given I return from Paystack, When the server verifies the reference, Then I see success only if the donation is succeeded.
- AC2: Given the webhook has not arrived, When I load the page, Then it says "We are confirming your gift" and refreshes the status up to 30 seconds.
- AC3: Given I edit the URL, When I load it, Then nothing personal is shown without the signed receipt token.
- Edge: page has `noindex` and no third party scripts.
- Error: failure shows a calm message and the support email.
- Empty: not applicable.

### M48-S30 Email receipt (Must)
As a donor, I want an emailed receipt, so that I have a record.
- AC1: Given a donation succeeded, When processed, Then one email with reference, amount, date and organisation name is queued through the outbox.
- AC2: Given the donor name has markup, When rendered, Then it is escaped.
- AC3: Given tax text is not configured, When the receipt renders, Then it does not claim deductibility.
- Edge: guests receive it too, using only the email they typed.
- Error: delivery failure retries through the outbox and shows in the admin row.
- Empty: not applicable.

### M48-S31 Monthly donation (Should)
As a donor, I want to give every month, so that I can support steadily.
- AC1: Given monthly is enabled, When I tick "Give monthly", Then the button shows "Give NGN X every month" and the subscription starts on payment.
- AC2: Given a later month, When the charge succeeds, Then a new donation row and receipt exist for that month.
- AC3: Given a charge fails, When Paystack reports it, Then I get one email asking me to update my card.
- Edge: changing the amount means starting a new monthly gift and cancelling the old one.
- Error: plan creation failure shows the one time option as a fallback message.
- Empty: not applicable.

### M48-S32 Cancel monthly giving (Should)
As a donor, I want to stop at any time, so that I stay in control.
- AC1: Given a monthly email, When I open the manage link, Then I can cancel in one step.
- AC2: Given I enter my email on the manage page, When submitted, Then the answer is always "If a monthly gift exists we have emailed a link".
- AC3: Given the link is older than 30 days, When opened, Then it asks me to request a new one.
- Edge: cancelling twice is harmless.
- Error: provider failure shows Retry and keeps the state.
- Empty: not applicable.

### M48-S33 Guests can donate (Must)
As a visitor without an account, I want to donate with only an email, so that nothing blocks me.
- AC1: Given I am a guest, When I donate, Then I am never asked to sign up.
- AC2: Given I am signed in, When I donate, Then my email is prefilled and the gift is linked to my account, and I can untick "link to my account".
- AC3: Given a guest session, When a gift is made, Then the guest cookie is not extended or used as a payment identifier.
- Edge: signing in later does not retroactively link past gifts.
- Error: not applicable.
- Empty: not applicable.

### M48-S34 Kids cannot donate (Must)
As a parent, I want children unable to start a payment, so that no child is charged.
- AC1: Given a kids profile or Kids mode, When `POST /api/donate/checkout` is called, Then it returns 403.
- AC2: Given Kids mode, When the page loads, Then `/donate` shows "Ask a grown-up to help" with no form.
- Edge: audience is derived on the server, never from the body.
- Error: unknown audience fails closed.
- Empty: not applicable.

### M48-S35 Test mode and live guard (Must)
As the developer and owner, I want safe testing and no accident in live mode, so that real money is handled deliberately.
- AC1: Given no Paystack key, When I try to enable donations, Then the switch refuses and says which variable is missing.
- AC2: Given a test key, When donations run, Then the page and admin show a Test mode badge, and test rows are excluded from totals.
- AC3: Given a live key outside production, When the app starts, Then it refuses to boot the payments module.
- Edge: switching keys never mixes test and live rows (rows store `site_mode`).
- Error: webhook events for the other mode are stored and ignored.
- Empty: not applicable.

### M48-S36 Admin donations list and export (Must)
As an admin, I want to see and export donations, so that I can do accounts.
- AC1: Given donations exist, When I open Donations, Then I see date, reference, amount, status, kind, masked email, and filters.
- AC2: Given I press Reveal email, When I confirm, Then the email shows and an audit row records who revealed it.
- AC3: Given I export, When the file is built, Then it is a queued CSV with formula neutralisation.
- Edge: anonymous gifts hide the name in lists.
- Error: export failure shows Retry.
- Empty: "No donations yet."

### M48-S37 Reconcile pending gifts (Should)
As the owner, I want missed webhooks recovered, so that every paid gift is recorded.
- AC1: Given a pending donation older than 15 minutes, When the job runs, Then it is verified with Paystack and updated.
- AC2: Given a pending gift older than 24 hours with no payment, When the job runs, Then it becomes abandoned.
- Edge: a succeeded gift is never downgraded.
- Error: provider errors retry with backoff.
- Empty: not applicable.

### M48-S38 Transparency page (Should)
As a donor, I want to see how donations are used, so that I can trust the project.
- AC1: Given the page is enabled, When I open `/transparency`, Then I see the owner's items, their share or amount, and the last updated date.
- AC2: Given percent mode, When the owner saves, Then items must total 100 percent.
- AC3: Given the page is disabled, When requested, Then it returns 404 and no link shows.
- Edge: no donor names ever appear.
- Error: not applicable.
- Empty: not applicable (disabled by default).

### M48-S39 Diaspora USD gifts (Could)
As a donor abroad, I want to give in US dollars, so that my bank does not convert at a poor rate.
- AC1: Given USD is enabled and Paystack has USD on the account, When I open `/donate`, Then I can switch currency to USD with its own presets.
- AC2: Given USD is not enabled, When I open `/donate`, Then no currency switch shows.
- Edge: totals never add NGN and USD together.
- Error: USD initialisation failure falls back to NGN with a message.
- Empty: not applicable.

### M48-S40 Bank transfer instructions (Could)
As a donor who prefers a transfer, I want account details, so that I can pay from my bank app.
- AC1: Given it is enabled, When I open `/donate`, Then the instructions show as escaped text with a copy button for the account number.
- AC2: Given an admin receives a transfer, When they add a manual donation, Then it is stored with source manual and audited.
- Edge: no receipt is emailed unless the admin chooses to.
- Error: not applicable.
- Empty: not applicable.

### M48-S41 Flutterwave option (Could)
As the owner, I want a second provider if Paystack is a problem, so that I am not locked in.
- AC1: Given the Flutterwave variables are set and the provider is selected, When a donor pays, Then the same flow works through the provider interface.
- AC2: Given a webhook with a wrong `verif-hash`, When it arrives, Then it is rejected.
- Edge: only one provider is active at a time.
- Error: not applicable.
- Empty: not applicable.

### M48-S42 Failed and refunded gifts (Should)
As an admin, I want failures and refunds shown clearly, so that my books match Paystack.
- AC1: Given a failed payment, When processed, Then the row shows Failed with the reason code and no receipt.
- AC2: Given a refund event, When processed, Then the row shows Refunded and totals exclude it.
- Edge: partial refunds are shown as needs review.
- Error: not applicable.
- Empty: not applicable.

### M48-S43 Abuse and card testing protection (Must)
As the owner, I want fraudsters unable to use the form to test stolen cards, so that the account stays in good standing.
- AC1: Given more than the allowed initiations per IP or per email hash per hour, When another arrives, Then it gets 429.
- AC2: Given repeated limit hits and Turnstile configured, When the form loads, Then a challenge is required.
- AC3: Given many pending rows from one source, When the reconcile job runs, Then they are marked abandoned and the admin sees an alert.
- Edge: limits are tunable in config constants.
- Error: limiter failure fails closed for checkout.
- Empty: not applicable.

### M48-S44 Privacy notice and retention (Must)
As a donor, I want to know what is stored and for how long, so that I can trust the platform.
- AC1: Given I open `/donate`, When I look under the form, Then a short notice states what we store (email, optional name, amount), who processes it (Paystack), the legal basis and retention, and links to the Privacy page.
- AC2: Given a marketing tick box, When shown, Then it is unticked by default and not required.
- AC3: Given a deletion request, When handled, Then name, message and email are erased or hashed while amounts and references remain for accounts, as explained in the notice.
- Edge: guests are covered by the same notice.
- Error: not applicable.
- Empty: not applicable.

## M49 Account security, activity and reach

### M49-S01 Turn on two step verification (Should)
As a viewer, I want to protect my account with an authenticator app, so that a stolen password is not enough.
- AC1: Given I am an adult on `/account/security`, When I choose Turn on, Then I see a QR code and a manual key, and nothing is enabled until I enter a valid 6 digit code.
- AC2: Given the code is valid, When I confirm, Then ten single-use recovery codes are shown once with Copy and Download, I must tick "I saved these codes" to finish, and I get a "Two step verification is on" email.
- AC3: Given I leave before confirming, When I return, Then two step verification is still off and the old pending secret is discarded.
- AC4: Given I am in a Kids profile, When I try to open the screen, Then I see the password gate (M35).
- Edge: starting again replaces the unconfirmed secret; the secret is stored encrypted with my user key.
- Error: an invalid code shows "That code is not right. Check the time on your phone and try again." and counts toward the code lockout.
- Empty: not applicable.

### M49-S02 Verify at sign in (Should)
As a viewer with two step verification, I want to be asked for a code at sign in, so that only I can enter.
- AC1: Given 2FA is on and my password is right, When I sign in, Then I am sent to `/sign-in/verify` and no session with account access exists until the code is accepted.
- AC2: Given a valid code, When I submit, Then I continue to `next` or `/profiles` as usual.
- AC3: Given a code already used in its 30 second window, When I submit it again, Then it is refused (replay guard).
- AC4: Given the pending sign in is older than 10 minutes, When I submit, Then I am told to start again.
- AC5: Given I signed in with Google, When 2FA is on, Then the same step applies.
- Edge: codes one step either side are accepted for clock drift.
- Error: repeated wrong codes lock the step with the shared lockout copy; the lock does not reveal whether the password was right elsewhere.
- Empty: not applicable.

### M49-S03 Recovery codes (Should)
As a viewer, I want backup codes, so that losing my phone does not lock me out.
- AC1: Given I enter a valid recovery code at the challenge, When I submit, Then I am signed in and that code can never be used again.
- AC2: Given two or fewer codes remain, When I open Security, Then a warning offers Get new codes and an email is sent once.
- AC3: Given I choose Get new codes and confirm my password, When it completes, Then ten new codes are shown once and every old code stops working.
- Edge: codes accept any case and with or without the dash.
- Error: a wrong password on regenerate counts toward lockout.
- Empty: with no unused codes the card says "No backup codes left" and offers new ones.

### M49-S04 Turn off or reset two step verification (Should)
As a viewer, I want to turn it off, and as an admin, I want to help someone who lost their phone and codes, so that nobody is locked out forever.
- AC1: Given I enter my password and a current code (or recovery code), When I choose Turn off, Then the factor and codes are deleted, my other sessions are revoked and I get an email.
- AC2: Given I am an admin on a viewer's user page, When I choose Reset two step verification and give a reason, Then the factor and codes are removed, the person is emailed, and an audit entry records who and why.
- AC3: Given I am not an admin, When I call the reset route, Then it is refused.
- Edge: staff accounts cannot turn 2FA off (it is required).
- Error: wrong password or code shows the generic message and counts toward lockout.
- Empty: not applicable.

### M49-S05 Sign in with Google (Should)
As a viewer, I want to continue with my Google account, so that I do not have to make another password.
- AC1: Given Google sign in is configured and enabled, When I open Sign in or Sign up, Then I see "Continue with Google" under the main button; when it is not configured the button is absent and the Google routes return 404.
- AC2: Given I choose it and Google returns a verified email that matches no account, When I return, Then an account is created (verified, no password), a first profile step follows, and I land on `next` or `/profiles`.
- AC3: Given Google returns an unverified email or the request fails, When I return, Then I see "We could not sign you in with Google" and a button back to Sign in, and no account is touched.
- AC4: Given the state, nonce or PKCE check fails, When I return, Then the same generic message shows and the event is logged.
- AC5: Given an account is a staff role, When Google returns its email, Then sign in is refused with the generic message and the attempt is audited.
- Edge: a Google email change does not move the identity; the Google subject is the key.
- Error: suspended or pending deletion accounts follow M02-S08.
- Empty: not applicable.

### M49-S06 Link and unlink Google (Should)
As a viewer with a password account, I want to connect Google safely, so that I can use either.
- AC1: Given Google returns an email that matches my verified password account, When I come back, Then I am asked for my password (or an emailed code if I have none) once before linking, and nothing is linked until I pass.
- AC2: Given an unverified password account exists for that email, When Google returns it verified, Then the account is adopted, its old password is cleared, and it is marked verified.
- AC3: Given I am signed in, When I choose Connect Google in Security, Then the same flow runs and the connected address shows masked.
- AC4: Given Google is my only way in, When I choose Unlink, Then I am told to set a password first.
- AC5: Given I link or unlink, When it completes, Then I get an email and an audit entry is written.
- Edge: one Google identity can belong to only one account.
- Error: wrong password on link counts toward lockout.
- Empty: not connected shows the Connect button.

### M49-S07 Guest progress after Google sign in (Should)
As a guest who watched before signing in, I want my progress kept, so that I do not lose my place.
- AC1: Given I have progress on this device and I sign in with Google, When I land, Then the same one time import prompt as after a password sign in appears (M01-S13 guest rules) and only fills missing or older entries, up to 100.
- AC2: Given I decline, When I continue, Then nothing is uploaded and the device keeps its local progress.
- Edge: the guest cookie is never merged on the server and no guest data goes to Google.
- Error: an import failure shows a retry and leaves local data intact.
- Empty: with no local progress there is no prompt.

### M49-S08 Passkeys (Could)
As a viewer, I want to sign in with my fingerprint or screen lock, so that I need no code.
- AC1: Given my device supports passkeys, When I choose Add a passkey and approve, Then it is saved with a label and listed in Security.
- AC2: Given I have a passkey, When I sign in, Then I can use it as my second step (and later in place of the password).
- AC3: Given I remove a passkey, When I confirm, Then it stops working and I get an email.
- Edge: unsupported browsers hide the control.
- Error: a cancelled prompt returns quietly to the form.
- Empty: no passkeys shows the Add button only.

### M49-S09 Viewing activity (Should)
As a viewer, I want to see what a profile watched, so that I can remove things I do not want on a shared device.
- AC1: Given I open `/account/activity`, When it loads, Then I see the active profile's titles newest first, grouped by day, with poster, title, episode, time and progress, loaded in pages of 25.
- AC2: Given I choose Remove on an entry, When it completes, Then it leaves the list and Continue Watching, an Undo toast shows for the undo window, and the title starts from the beginning next time.
- AC3: Given I have several profiles, When I choose another profile tab, Then I see that profile's list only.
- AC4: Given I am in a Kids profile, When I open the page, Then I see the password gate (M35).
- AC5: Given a title was unpublished, When the list loads, Then it is not shown.
- Edge: a series shows each episode watched with the series name.
- Error: load failure shows an inline retry card; a failed remove restores the row and shows an error toast.
- Empty: "Nothing here yet. Titles you watch will show up here." with a Browse button.

### M49-S10 Clear viewing activity (Should)
As a viewer, I want to clear a profile's whole history, so that I can start fresh.
- AC1: Given I choose Clear all and confirm in the dialog, When it completes, Then every entry for that profile is deleted, Continue Watching is empty, and an audit entry records only the count.
- AC2: Given I cancel or press Escape, When the dialog closes, Then nothing changes and focus returns to the button.
- AC3: Given I want a copy first, When I look at the page, Then a link to Download my data (M02-S05) is shown.
- Edge: other profiles are untouched.
- Error: a failure leaves the list as it was and offers retry.
- Empty: the Clear all button is hidden when the list is empty.

### M49-S11 Caption appearance and defaults (Should)
As a viewer, I want to set how captions look, so that I can read them on my screen.
- AC1: Given I open `/settings/playback`, When I change size, background, edge or colour, Then the preview updates at once, the choice saves for this profile only, and the player uses it on the next caption cue.
- AC2: Given the save fails, When the server rejects, Then the control rolls back and an error toast stays.
- AC3: Given I choose Reset to defaults, When I confirm, Then the caption choices return to defaults.
- AC4: Given the device is on Data saver, When I open the page, Then a note says so and the profile default is still editable.
- Edge: a yellow colour with no background is refused when it would fail contrast.
- Error: offline changes queue and show "Saved on this device".
- Empty: not applicable.

### M49-S12 Sign out everywhere (Should)
As a viewer, I want one button to end every session including this one, so that a lost phone is dealt with in one step.
- AC1: Given I choose Sign out everywhere and enter my password, When it completes, Then all sessions including this one end and I land on Sign in with a notice.
- AC2: Given a device is playing, When its session ends, Then playback stops at the next token refresh (5 minutes at most).
- Edge: "Sign out all other devices" stays as the milder option.
- Error: wrong password counts toward lockout.
- Empty: not applicable.

### M49-S13 New device sign in email (Should)
As a viewer, I want an email when someone signs in from a new device, so that I notice a stranger.
- AC1: Given I sign in from a device not seen before on an account that has signed in before, When it succeeds, Then I get an email with device, country and time and links to change password and sign out everywhere.
- AC2: Given a known device, When I sign in, Then no email is sent.
- AC3: Given several new devices within an hour, When they sign in, Then at most one email is sent per hour.
- Edge: the first ever sign in sends nothing.
- Error: an email failure never blocks sign in and is logged.
- Empty: not applicable.

### M49-S14 Login history (Could)
As a viewer, I want to see recent sign ins, so that I can spot anything odd.
- AC1: Given I open Security, When it loads, Then I see my last 20 sign in attempts with outcome, country, device label and time, never an IP address.
- AC2: Given entries are older than 90 days, When the job runs, Then they are deleted.
- Edge: unknown country shows "Unknown place".
- Error: load failure shows an inline retry.
- Empty: "No sign ins to show yet."

### M49-S15 TV mode (Should)
As a viewer on a smart TV browser, I want to move around with the remote, so that I can pick and play without a mouse.
- AC1: Given my browser is a known TV browser, or I open `/tv`, or I turn TV mode on, When Home loads, Then text is larger, focus is a thick visible ring on tiles and controls, and hover only effects and previews are off.
- AC2: Given TV mode is on, When I press Up, Down, Left or Right, Then focus moves to the nearest visible control in that direction and rows scroll to keep it in view.
- AC3: Given focus is on a tile, When I press Enter, Then the title opens; Back (or Escape) returns to the previous page.
- AC4: Given I am typing in a field, When I press Left or Right, Then the keys move the caret and not the focus.
- AC5: Given TV mode is off, When I use the site, Then nothing changes.
- Edge: content stays inside a 5 percent safe area.
- Error: if focus has nowhere to go, it stays and nothing is lost.
- Empty: not applicable.

### M49-S16 Sign in on a TV with a code (Could)
As a viewer, I want to approve a TV from my phone, so that I do not type a password with a remote.
- AC1: Given I open `/activate` on the TV, When it loads, Then I see a 6 character code and a short web address.
- AC2: Given I sign in on my phone and enter the code, When I approve, Then the TV signs in within 10 seconds.
- AC3: Given 10 minutes pass or 5 wrong codes are entered, When I try, Then the code is dead.
- Edge: watching never needs this; guests can play.
- Error: a failed approval shows a retry.
- Empty: not applicable.

### M49-S17 Cast and AirPlay (Could, owned by lane L4)
As a viewer, I want to send a video to my TV, so that I can watch on a big screen.
- AC1: Given my browser supports AirPlay, When I open the player, Then an AirPlay button shows and sends the stream.
- AC2: Given Chromecast is supported by a later build, When I choose Cast, Then playback moves to the TV and the phone becomes a remote.
- Edge: kids profiles keep their kids rules on the receiver.
- Error: no device found shows a one line hint.
- Empty: the button is hidden when nothing is supported.

### M49-S18 Save a title for offline (Could, not now)
As a viewer with little data, I want to save a lesson on my phone on Wi-Fi, so that I can watch it later.
- AC1: Given I use the installed app on a supported browser, When I choose Save offline on a title, Then I see the size and a storage check before it starts, and it downloads at 360p or 480p only.
- AC2: Given storage is short, When I start, Then I am told how much space is needed and what I can remove.
- AC3: Given the download completes, When I am offline, Then it plays from the device.
- Edge: at most 3 titles and 500 MB by default, both configurable.
- Error: an interrupted download resumes; a failed one shows retry.
- Empty: "No saved lessons yet."

### M49-S19 Offline licence, expiry and cleanup (Could, not now)
As the owner, I want saved lessons to expire and be removed, so that the offline copies stay controlled.
- AC1: Given a title is saved, When 14 days pass (configurable) or the viewer signs out, Then the copy and its key are deleted from the device.
- AC2: Given the title is unpublished, When the device next connects, Then the copy is removed.
- AC3: Given I open Saved lessons, When it loads, Then each shows size and days left with a Remove button.
- Edge: a Kids profile only sees kids titles.
- Error: if the licence cannot be renewed, the title says "Reconnect to keep this".

## M44 Engagement

### M44-S01 Rate a title (Must)
As a viewer, I want to tell the platform what I think of a title, so that I can find good ones again and others can too.
- AC1: Given I am signed in on an adult profile and open a title or series page, When I look at the actions, Then I see a group "Rate this title" with Not for me, I like this and Love this.
- AC2: Given I choose one, When I tap it, Then it shows pressed at once (optimistic), the other two are not pressed, and a toast says "Rating saved".
- AC3: Given I choose the level that is already pressed, When I tap it, Then my rating is cleared and the toast offers Undo for 6 seconds.
- AC4: Given the server rejects the change, When it fails, Then the control reverts and a persistent error toast says "We could not save your rating. Try again."
- Edge: ratings belong to the profile, another profile on the account has its own. Rating a series rates the whole series, episodes cannot be rated on their own. Rating twice is idempotent.
- Error: the title was unpublished meanwhile, show "This title is no longer available" and keep the control disabled.
- Empty: a title never rated shows no pressed button.

### M44-S02 Change or review my ratings (Should)
As a viewer, I want to see what I rated, so that I can change my mind.
- AC1: Given I have rated titles, When I open a card or page for one, Then my level shows pressed.
- AC2: Given I change a rating, When it saves, Then every card of that title on the current page updates.
- Edge: ratings of titles that were unpublished are kept and return if the title returns.
- Error: not applicable.
- Empty: not applicable.

### M44-S03 Ratings on the title page and the hover card (Must)
As a viewer, I want to rate from where I choose, so that it takes one tap.
- AC1: Given a desktop with a mouse, When a card is hovered for 300 ms (ruling R10) or focused, Then a thumb button shows in the card actions beside My List and expands to the three levels on hover or focus.
- AC2: Given a touch device, When I look at a card, Then there is no rating control on the card, and the title page has the full group.
- AC3: Given a keyboard user, When focus is on a card, Then Tab reaches My List and the rating chip, the hover overlay text is shown on focus too, and every control has an accessible name.
- AC4: Given a title page at 360 px, When it loads, Then Play is a full width button and My List, rating group and Share sit in a second row with 44 px targets and no horizontal scroll.
- Edge: Data saver does not change the controls.
- Error: failure behaves as in M44-S01.
- Empty: not applicable.

### M44-S04 Guests are asked to sign in to save a rating (Should)
As a visitor without an account, I want a clear way to keep my rating, so that I can join when I am ready.
- AC1: Given I am a guest, When I tap a rating, Then the "Sign in to save" dialog opens with the reason "Sign in to rate this title" and nothing is stored on the server or the device except the pending intent.
- AC2: Given I sign in or sign up, When I return to the title, Then my rating is applied once to my chosen profile and a toast says "Saved to your profile".
- AC3: Given the intent is older than 15 minutes or was tampered with, When I return, Then it is ignored.
- AC4: Given I choose a kids profile after signing in, When the intent is a rating, Then it is dropped silently.
- Edge: I tap Not now, the dialog closes and the control stays unpressed.
- Error: replay failure shows "We could not save your rating. Try again." and keeps the control usable.
- Empty: not applicable.

### M44-S05 Most liked label (Should)
As a viewer, I want to see which titles people liked most, so that I can pick well.
- AC1: Given a title has at least 10 ratings and at least 85 percent Like or Love, When it ranks in the top quarter of eligible titles (at most 10), Then the title page and hover card show a "Most liked" label.
- AC2: Given fewer than 10 ratings, When the page loads, Then no label and no count show to viewers.
- AC3: Given the numbers change, When the 15 minute rollup runs, Then labels update.
- Edge: one eligible title still gets the label. Counts are never shown to viewers.
- Error: if stats cannot load, the label is omitted and the page works.
- Empty: new platform, no labels.

### M44-S06 Admin rating analytics (Should)
As an admin, I want to see how titles are rated, so that I can make more of what people like.
- AC1: Given `/admin/analytics`, When Top titles shows, Then columns Likes, Love, Not for me and Positive share are available and sortable.
- AC2: Given a title with fewer than 10 ratings, When shown, Then it says "Under 10 ratings" instead of counts.
- AC3: Given the CSV export, When I export, Then the three counts are included as current totals.
- Edge: no rater identity is ever shown.
- Error: partial failure shows retry per tile (as M19-S02).
- Empty: "No ratings yet".

### M44-S07 Trending now row (Must)
As a viewer, I want to see what others are watching now, so that I can join in.
- AC1: Given the Trending now row, When Home loads, Then it lists up to 20 titles ranked by plays in the last 7 Lagos days, newer days weighing more, filtered for my profile (kids and maturity).
- AC2: Given fewer than 5 titles have at least 10 plays, or the site had fewer than 50 plays in the window, When Home loads, Then the row is not rendered (no fake trending).
- AC3: Given one viewer plays a title many times in a day, When counted, Then that viewer adds at most 3 plays per day.
- AC4: Given the snapshot is older than 3 hours, When Home loads, Then the row is not rendered and an admin warning shows on the System page.
- Edge: series appear, scored by their episodes.
- Error: row failure shows the inline row retry like M05-S02.
- Empty: row not rendered.

### M44-S08 Popular row and cold start (Must)
As an admin, I want a Popular row that is honest on a new site, so that Home is never empty or misleading.
- AC1: Given the Popular row, When Home loads, Then it lists titles by views in the last 30 days with at least 5 views each, series included.
- AC2: Given fewer than 3 titles qualify and "Fall back to newest" is ticked, When Home loads, Then the row shows with the editor's fallback title (default "Newly added") and newest titles.
- AC3: Given fewer than 3 qualify and the option is off, When Home loads, Then the row is not rendered.
- Edge: kids profiles see kid titles only.
- Error: as M44-S07.
- Empty: as AC3.

### M44-S09 Top 10 numbered row (Could)
As a viewer, I want a clear top ten list, so that I know what is biggest.
- AC1: Given Top 10 is switched on in Home curation, When 10 titles qualify for my profile, Then the row shows exactly 10 tiles numbered 1 to 10 after my filters.
- AC2: Given fewer than 10 qualify, When Home loads, Then the row is not rendered.
- AC3: Given a screen reader, When the row is read, Then it is an ordered list and each link starts with "Number 3,".
- Edge: the numeral is large display type on a scrim, never the only way to tell rank (position and text carry it).
- Error: as M44-S07.
- Empty: not rendered.

### M44-S10 Curate the new row kinds (Should)
As an editor, I want to add Trending, Top 10 and Most liked rows, so that Home stays fresh with no weekly work.
- AC1: Given Home curation, When I add a row, Then the type list includes Trending now, Top 10, Most liked with one line of help each.
- AC2: Given a Popular row, When I edit it, Then I can tick "Fall back to newest" and set the fallback title.
- AC3: Given a launch seed, When the site is first set up, Then rows exist in this order: Continue Watching, My List, Trending now, Newly added, one per category.
- Edge: kids visibility is set per row as today.
- Error: save failure keeps my edits and shows retry.
- Empty: not applicable.

### M44-S11 Notification bell for viewers (Must)
As a viewer, I want a bell that tells me about new things, so that I come back.
- AC1: Given I am signed in on an adult profile, When there are unread notices, Then the bell shows the count (9+ above 9) with a spoken "3 unread notifications".
- AC2: Given I open the bell on desktop, When the popover opens, Then I see the latest 10 with "Mark all as read" and "See all"; on a phone it opens `/notifications`.
- AC3: Given I tap a notice, When it opens, Then it is marked read and goes to the title or series page.
- AC4: Given Data saver is on, When I browse, Then the count is fetched only when I open the bell.
- Edge: read state is per profile.
- Error: load failure shows "We could not load notifications. Try again."
- Empty: "Nothing new. We will tell you when something arrives."

### M44-S12 New episode notices (Must)
As a viewer, I want to know when a series I follow has a new episode, so that I keep watching.
- AC1: Given a series is in my My List or I watched an episode in the last 120 days, When a new episode goes live, Then I get one notice "3 new episodes of <title>" per run.
- AC2: Given the episode is above my profile's maturity limit, When it goes live, Then I get no notice.
- AC3: Given the job runs twice, When it finishes, Then I have exactly one notice.
- Edge: scheduled publishing counts when the promotion time passes. Videos that were live before launch never notify.
- Error: a failed run retries and never creates a duplicate.
- Empty: not applicable.

### M44-S13 New video notices (Should)
As a viewer, I want a daily note when new videos arrive, so that I can browse them.
- AC1: Given new standalone videos went live today, When the job runs, Then I get one grouped notice per day, "5 new videos", with the first three titles.
- AC2: Given I switched "New videos" off, When videos go live, Then no notice is created.
- Edge: videos above my maturity limit are not counted.
- Error: as M44-S12.
- Empty: not applicable.

### M44-S14 Notification settings per account (Must)
As an account owner, I want to choose what I am told, so that I am not flooded.
- AC1: Given `/account/notifications`, When I open it, Then I can switch Bell, New episodes and New videos, choose email Off, Daily or Weekly, and see my masked address.
- AC2: Given email is off by default, When I switch it on, Then the page states in one line what will be sent and I confirm, and the consent time is recorded.
- AC3: Given I change my account email, When it saves, Then the email notification address follows.
- Edge: security emails cannot be turned off and are not listed.
- Error: save failure reverts the switch and shows an error toast.
- Empty: not applicable.

### M44-S15 Email digest (Should)
As an account owner who opted in, I want one short email, so that I hear about new things without checking the site.
- AC1: Given email is Daily or Weekly, When the digest job runs at 07:20 Lagos time (Monday for weekly), Then I get one email with at most 10 lines (title and link), HTML and plain text, under 30 KB, no tracking pixels.
- AC2: Given my address is on the suppression list, When the job runs, Then nothing is sent.
- AC3: Given the email, When I open it, Then it has a one click Unsubscribe link and the List-Unsubscribe header, and the link works without signing in.
- AC4: Given the email content, When it is built, Then it never names a profile, never includes kids profile activity, and is limited by the primary profile's maturity limit.
- Edge: no notices means no email. Copy follows UI writing rules.
- Error: provider outage queues the mail with the outbox retry rules (M21-S01).
- Empty: not applicable.

### M44-S16 Web push (Could)
As a viewer on a phone, I want a push when something new arrives, so that I do not miss it.
- AC1: Given push is supported and configured, When I press "Turn on push" on the settings page, Then the browser asks permission only after that press, and a subscription is stored sealed.
- AC2: Given a push is sent, When it shows, Then it says "New on <site name>" with a count and no title.
- AC3: Given I tap it, When it opens, Then I land on `/notifications` (or Home under a kids lock).
- Edge: three failed sends or 30 days without success remove the subscription.
- Error: permission denied shows how to allow it, without nagging.
- Empty: the button is hidden when push is not configured.

### M44-S17 Kids profile notification rules (Must)
As a parent, I want notifications to stay out of kids profiles, so that children see nothing they should not.
- AC1: Given a kids profile is active, When any page loads, Then no bell shows and `/notifications` shows "This is not available on this profile".
- AC2: Given a kids profile exists, When new titles go live, Then no notices are created for it.
- AC3: Given the notification API, When called under a kids lock, Then it answers 403 and the count is 0.
- AC4: Given push, When a kids profile is active, Then subscribing is refused.
- Edge: switching to an adult profile restores the bell after the password step.
- Error: not applicable.
- Empty: not applicable.

### M44-S18 Admin sets a maturity rating (Must)
As an admin, I want to rate each title on a five step scale, so that profiles can be limited precisely.
- AC1: Given I edit a video or series, When I choose a Maturity rating (default labels G, PG, 12, 15, 18), Then it saves and an audit entry records old and new value.
- AC2: Given no rating is chosen, When I try to publish, Then publishing is blocked with "Choose a maturity rating".
- AC3: Given I bulk select videos, When I apply a rating, Then all update or none do, and failed ids are listed.
- AC4: Given a series, When I set its rating, Then I can apply it to all episodes after a confirm.
- Edge: labels come from site settings and can be renamed without code.
- Error: validation shows the five valid values.
- Empty: not applicable.

### M44-S19 Profile maturity limit (Must)
As a parent, I want to set the highest rating each profile may watch, so that each person sees what suits them.
- AC1: Given Edit profile on an adult profile, When I choose "Allow titles rated up to", Then the limit saves and applies at once to every list, search and playback.
- AC2: Given I raise the limit, When I save, Then I must enter the account password.
- AC3: Given I lower the limit, When I save, Then no password is needed.
- AC4: Given a kids profile, When I open its settings, Then the limit is fixed at the lowest rating and says why.
- Edge: turning Kids off sets the limit to 12 and I can change it right away; the last adult profile rules of M03-S10 still apply.
- Error: wrong password shows "That password is not right" and keeps the old limit. Concurrent edit shows "This profile changed. Reload."
- Empty: not applicable.

### M44-S20 Maturity is enforced everywhere (Must)
As a parent, I want the limit to hold on every path, so that it cannot be bypassed.
- AC1: Given a profile limited to 12, When it opens Home, Browse, Search, suggestions, Related, My List, Continue Watching, a series page, a title URL or a watch URL, Then titles rated above 12 or unrated never appear and direct links answer as not found.
- AC2: Given a playback session or key request for such a title, When made, Then it is refused.
- AC3: Given the filter cannot be evaluated, When a query fails, Then the result is empty, never unfiltered (fail closed).
- Edge: titles in My List above the limit are kept and hidden, with the existing hidden count message.
- Error: not applicable.
- Empty: as M35-S01.

### M44-S21 Maturity badge (Should)
As a viewer, I want to see a title's rating before I play, so that I know what to expect.
- AC1: Given a title page, When it loads, Then the rating label shows next to the duration, with a visually hidden full phrase "Rated 15".
- AC2: Given a card on desktop hover or focus, When the overlay shows, Then it includes the rating label unless the title is G.
- Edge: labels follow the site setting.
- Error: not applicable.
- Empty: unrated titles are not visible to limited profiles, so no empty badge appears.

### M44-S22 Legacy compatibility and migration (Must)
As the developer, I want the new ratings to keep the old kids flag working, so that nothing breaks during rollout.
- AC1: Given the migration runs, When it completes, Then every video and series has a rank (kids safe titles 0, "older" 3, the rest 2) and `kids_safe` equals rank 0 everywhere.
- AC2: Given any writer sets a rank, When it saves, Then `kids_safe` follows by trigger.
- AC3: Given the old API fields, When read, Then they still return the same values for one release.
- Edge: rollback of the code leaves the data valid.
- Error: a mismatch between `kids_safe` and rank is reported by a check query in the runbook.
- Empty: not applicable.

### M44-S23 Continue Watching polish (Should)
As a viewer, I want the row to say exactly where I am, so that I resume with confidence.
- AC1: Given an episode card, When shown, Then it carries "S1 E4", and a "Next: E4" badge when the card is the next episode at position 0.
- AC2: Given any card, When shown, Then the time left reads "12 min left" or "1 h 05 min left".
- AC3: Given I open the card menu (kebab), When I choose "Remove from row", Then the card disappears at once with Undo for 6 seconds; "Go to title page" opens the title.
- AC4: Given a keyboard, When the menu is open, Then arrow keys move, Enter chooses, Escape closes and focus returns to the kebab.
- Edge: the row title comes from curation.
- Error: failure restores the card with an error toast.
- Empty: not shown when empty.

### M44-S24 My List filters and sort (Should)
As a viewer with a long list, I want to filter and sort it, so that I find what I need.
- AC1: Given `/my-list`, When I choose All, Started or Not started, Then the grid shows only those, with a count on each choice, and the choice is in the URL.
- AC2: Given I choose Newest added, Oldest added, A to Z or Z to A, When applied, Then the order changes in the query and pages of 24 stay in order without repeats.
- AC3: Given a filter has no results, When shown, Then I see a plain sentence and a "Show all" action.
- AC4: Given I am offline, When I open the list, Then I see the saved first page with "Showing saved list".
- Edge: a finished title counts as Started. A series counts as Started when any episode is started. Kids and maturity limits apply.
- Error: load failure shows retry and keeps the choices.
- Empty: as M10-S03.

### M44-S25 Engagement data privacy and deletion (Must)
As a viewer, I want my ratings and notices handled with care, so that I can trust the platform.
- AC1: Given my data export, When it is ready, Then it includes my ratings and notices for each profile.
- AC2: Given account deletion completes, When the purge runs, Then ratings, notices, notification settings and push subscriptions are gone.
- AC3: Given the privacy page, When viewed, Then it states what is stored (ratings per profile, notices, optional email and push settings) and for how long (notices 60 days).
- AC4: Given analytics, When counted, Then only totals per title are used and no rater is identifiable; kids profiles contribute no ratings.
- Edge: deleting a profile deletes its ratings and notices.
- Error: partial purge retries until complete (M32-S03).
- Empty: not applicable.

## M41 Home hero, rows and sections

### M41-S01 Hero slides are still images first (Must)
As a viewer, I want a large featured title with clear art, so that Home looks alive and I know what to watch.
- AC1: Given Home loads, When the hero renders, Then each slide shows artwork, title, meta, a one line description, Play (or Continue with time left) and More info, and the first image loads with high priority.
- AC2: Given a phone under 960 px, When the hero renders, Then the 4:5 art is used, and from 960 px the 16:9 art is used, both with a scrim that keeps text at 4.5:1.
- AC3: Given the artwork fails to load, When the slide renders, Then a solid theme colour with the title and buttons still shows.
- Edge: with one slide there are no dots, arrows or pause control.
- Error: see AC3.
- Empty: see M41-S03.

### M41-S02 Hero advances by itself and can be controlled (Must)
As a viewer, I want the hero to move on in about 20 seconds and let me stop it, so that I see more titles without losing control.
- AC1: Given more than one slide and auto advance on, When 20 seconds pass (the site setting, 5 to 60), Then the next slide crossfades in over 350 ms, and the timer restarts when I use a dot, arrow or swipe.
- AC2: Given I hover or focus inside the hero, or the tab is hidden, When time passes, Then the slide does not change.
- AC3: Given I press Pause, When I look at the button, Then it reads "Resume rotation", the slide holds, and the region is announced politely; Resume restarts the timer.
- AC4: Given reduced motion or Data saver is on, When Home loads, Then slides never advance by themselves, there is no crossfade, and dots and arrows still work.
- AC5: Given the hero has looped through twice, When the third loop would start, Then rotation stops on the first slide (setting, 0 never stops).
- AC6: Given the dots, When a slide is running, Then the current dot shows time left as a fill that runs over the time the slide really stays (the dwell time, or the clip length plus 3.2 seconds when it waits for its clip), and dots have a 44 px hit area and `aria-current`.
- AC7: Given a slide has a clip that is playing and the setting Slide waits for its clip is on, When the dwell time passes, Then the slide stays until the clip ends, and moves on at the latest 3.2 seconds after the clip's own length; with the setting off the slide changes at the dwell time.
- AC8: Given the clip errors or stalls, When it is removed, Then that slide goes back to the dwell time.
- Edge: swipe left and right on touch changes slides with a 50 px threshold.
- Error: not applicable.
- Empty: not applicable.

### M41-S03 Hero never empty (Must)
As an admin, I want Home to look finished even if I have not picked hero titles, so that the site never shows a bare top.
- AC1: Given no hero titles are chosen, When Home loads, Then the 5 newest live titles that have artwork rotate as the hero.
- AC2: Given chosen hero titles are all unpublished, When Home loads, Then the same fallback applies; if some are live, only those show.
- AC3: Given a kids profile, When the fallback is used, Then only kids safe titles show.
- AC4: Given `/admin/home`, When no hero titles are chosen, Then the screen says "Home shows your 5 newest titles" and the preview lists them.
- Edge: fewer than 5 live titles shows as many as exist; one title behaves as M41-S01 Edge.
- Error: not applicable.
- Empty: with no live titles at all, the empty catalog state of M05-S07 shows.

### M41-S04 Sensible launch rows (Must)
As the launch engineer, I want default sections seeded by the apply tool, so that Home is complete on day one.
- AC1: Given an empty site, When `apply` runs, Then Home gets, in order, Continue learning, My List, New this week, Most watched this week, Browse by subject (a row per category) and Series, all visible and kids visible.
- AC2: Given a published Home layout already exists, When `apply` runs again, Then nothing changes and the report says unchanged.
- AC3: Given `home.seedDefaults` is false in the client config, When `apply` runs, Then the step is skipped.
- AC4: Given `--dry-run`, When the step runs, Then it lists what would be created and changes nothing.
- AC5: Given an admin presses "Restore launch defaults", When they confirm, Then the layout resets, the old one is kept as Previous, and an audit entry records it.
- Edge: row titles come from the client config when present.
- Error: a failure leaves the existing layout untouched and names the failing step.
- Empty: not applicable.

### M41-S05 Row types for learning (Must)
As a viewer, I want rows for new videos, what is popular, each subject, series and my own progress, so that I find something quickly.
- AC1: Given New, When Home loads, Then it lists the newest published titles (up to 20).
- AC2: Given Trending, When at least 4 titles have views in the last 7 days, Then it lists the most viewed; with fewer, the row is hidden and does not copy New.
- AC3: Given Browse by subject, When categories have at least 4 live titles, Then each shows as its own row in category order, at most 6, skipping a category that already has its own row.
- AC4: Given Series, When at least 2 series are live, Then a row of series cards shows.
- AC5: Given I have progress, When Home loads, Then "Continue learning" (title configurable) shows first below the hero.
- Edge: rows with no items are never rendered; kids profiles only get kids safe titles in every row.
- Error: one failing row shows an inline retry and the others render (M05-S02).
- Empty: rows with nothing to show are left out.

### M41-S06 Admin creates, names and removes sections (Must)
As an admin, I want to add a section, give it a name and rename it later, so that Home says what I mean.
- AC1: Given `/admin/home`, When I add a section and choose a type (Manual list, Category, New, Trending, Series, Each category, All series), Then I name it and it appears in the list.
- AC2: Given a section, When I rename it inline, Then Enter saves, Escape cancels, an empty name is refused with "Give the section a name", and the name is at most 60 characters.
- AC3: Given a section I made, When I delete it and confirm, Then it is removed (titles stay in the catalog); built in sections can only be hidden.
- AC4: Given 12 sections exist, When I add another, Then I am told the limit and nothing is added.
- Edge: names are trimmed and double spaces collapse; two sections may share a name but get different slugs.
- Error: a failed save keeps my changes on screen with Retry.
- Empty: "No sections yet" with a Create section button.

### M41-S07 Admin reorders sections (Must)
As an admin, I want to drag sections into order, so that the best rows come first.
- AC1: Given the section list, When I drag a section, Then the order changes with a drop marker and a live region says "Moved New this week to position 2".
- AC2: Given I use the keyboard, When I focus Move up or Move down, Then the section moves one place and focus stays on the same section.
- AC3: Given I save and publish, When viewers load Home, Then the order is the one I set (personal rows follow M05-S05).
- Edge: the live preview updates within 1 second.
- Error: failed save keeps the local order with Retry.
- Empty: not applicable.

### M41-S08 View all link per section (Must)
As an admin, I want each section to open a full list, so that viewers can see everything in it.
- AC1: Given a section, When I open its View all setting, Then I can pick Automatic, Custom link or None, and Automatic shows the target in words, for example "Opens All New videos".
- AC2: Given Custom, When I enter `/browse/farming` or `https://example.org/page`, Then it saves; `//x.com`, `http://` and `javascript:` are refused with "Use a path on this site or an https link".
- AC3: Given Automatic, When Home loads, Then New opens `/browse/new`, Trending `/browse/trending`, a category `/browse/{slug}`, a series section `/series/{slug}`, a manual list `/browse/row/{slug}`, All series `/browse/series`.
- AC4: Given a viewer on desktop, When they hover the row, Then "View all" fades in beside the title; on touch it is always visible; keyboard focus reveals it.
- AC5: Given an external custom link, When it renders, Then it carries an external mark and opens with `rel="noopener noreferrer"`.
- Edge: the label is a site setting (default "View all"); Continue learning has no View all.
- Error: a broken target shows the normal not found page.
- Empty: with None, no link renders.

### M41-S09 List pages behind View all (Must)
As a viewer, I want a page that lists everything in a section, so that I can browse without sideways scrolling.
- AC1: Given `/browse/new`, When it loads, Then I see all published titles newest first with Load more and the length filter.
- AC2: Given `/browse/trending`, When it loads, Then I see the top 50 for the last 7 days in rank order, with no sort control.
- AC3: Given `/browse/series`, When it loads, Then I see every live series as cards.
- AC4: Given `/browse/row/{slug}`, When the section is visible, Then I see its titles in the editor's order.
- AC5: Given an unknown or hidden slug, or a row that is not kids visible on a kids profile, When I open it, Then I get the not found page.
- Edge: `new`, `trending`, `series` and `row` cannot be category slugs.
- Error: "Could not load this list. Try again." with Retry.
- Empty: "Nothing here yet. See what is new." with a link to `/browse/new`.

### M41-S10 Rows feel native (Must)
As a viewer, I want rows that scroll like a real streaming app, so that browsing is smooth.
- AC1: Given a row, When it renders, Then 2.3 cards show on a phone, 3.3 from 600 px, 4.3 from 960 px, 5.3 from 1280 px and 6.3 from 1920 px, so the next card peeks.
- AC2: Given a phone, When I swipe, Then the row scrolls natively and snaps to a card.
- AC3: Given a mouse, When I hover a row, Then previous and next arrows fade in at the thumbnail middle and scroll by whole cards; touch devices never show arrows.
- AC4: Given keyboard focus on a card, When I press Left or Right, Then the row scrolls and focus follows.
- Edge: arrows hide at the ends; reduced motion scrolls without smooth animation.
- Error: see M05-S02.
- Empty: see M05-S02.

### M41-S11 Optional muted preview clip in the hero (Should)
As a viewer on a fast connection, I want a short preview that plays by itself on the featured title, so that it feels like a trailer. Sound is M41-S22.
- AC1: Given a fast connection, Data saver off, no reduced motion, a visible tab and a ready clip, When a slide has shown for 1.2 seconds, Then a muted clip of up to 20 seconds (the clip length setting) fades in over the still, plays by itself without sound, and fades back at the end.
- AC2: Given any condition fails, or the connection type is unknown and the setting Preview clips on unknown connections is off, or the reported speed is under the site floor (2 Mbps by default, setting 1 to 10), When the slide shows, Then only the still shows and no clip is requested.
- AC3: Given I press Pause or change slide, When the clip is playing, Then it pauses or unloads.
- AC4: Given the clip errors or stalls for 2 seconds, When it happens, Then it is removed and the still stays.
- AC5: Given the site setting for previews is off, When Home loads, Then no clip is ever requested.
- Edge: the connection drops to slow while playing, so the clip stops.
- Error: see AC4.
- Empty: a title with no clip uses its still.

### M41-S12 Worker generates preview clips (Should)
As an admin, I want clips made for me, so that I upload nothing extra.
- AC1: Given a video finished thumbnails, When the worker runs `video.preview`, Then an H.264 clip 854 px wide with low bitrate AAC audio (silent only when the source has none) is stored under `cap/{mediaPrefix}/preview/`, its length and sound are recorded, and the video shows state ready. The clip is the whole video when it is no longer than the clip length setting (20 seconds by default, 6 to 30), otherwise a segment of that length, and is accepted up to 120 KB a second.
- AC2: Given the auto mode, When a segment is chosen, Then it avoids the first and last parts and prefers the best lit and sharpest of five candidates.
- AC3: Given a black or very short video, When the job runs, Then the state is skipped and Home uses the still.
- AC4: Given a published video with no clip, When the hourly sweep runs, Then up to 10 are queued. Videos with a failed, skipped or out of date clip are queued by M41-S21.
- Edge: a recut replaces the old file and deletes it.
- Error: failure marks the clip failed with a plain reason and never fails the video.
- Empty: not applicable.

### M41-S13 Admin controls the preview clip (Should)
As an admin, I want to choose or turn off a clip, so that the preview shows the right moment.
- AC1: Given a video, When I open its Home preview card, Then I see the state (queued, ready, failed, skipped) and the choices Automatic, Pick a segment and Off.
- AC2: Given Pick a segment, When I enter a start time and see its frame, Then Save queues a recut; starts beyond duration minus the clip length are refused.
- AC3: Given Off, When I save, Then viewers get the still only, and the choice is audited.
- AC4: Given failed, When I press Retry, Then the job runs again.
- Edge: Editors may change it, Viewers may not.
- Error: a failed recut keeps the old clip.
- Empty: with no clip yet, the card says "A preview is made after the video is processed."

### M41-S14 Hover card on mouse devices (Should)
As a viewer with a mouse, I want a small card with details when I rest on a title, so that I can decide without opening it.
- AC1: Given a hover capable device with a fine pointer, When I rest on a card for 300 ms, Then a card opens at 1.25 scale with title, length, subject, Play, My List and More info; passing over under 300 ms opens nothing.
- AC2: Given the first or last visible card, When the card opens, Then it grows from the left or right edge so it stays on screen.
- AC3: Given touch or keyboard focus, When I interact, Then no hover card opens (focus shows the usual actions).
- AC4: Given Escape or leaving the card, When it happens, Then the card closes.
- Edge: reduced motion shows the card without scale or fade; there is never a video in the card.
- Error: not applicable.
- Empty: not applicable.

### M41-S15 Hero and rows states (Must)
As a viewer, I want clear loading, empty, error and offline states for the hero and rows, so that the page never looks broken.
- AC1: Given Home is loading, When the first paint happens, Then a skeleton with the exact hero ratio and two row skeletons show after 300 ms with no layout shift.
- AC2: Given the hero data fails, When Home renders, Then a solid theme panel with the site name shows and the rows still load.
- AC3: Given offline, When Home opens, Then the saved view shows with the offline banner and no clip is requested.
- AC4: Given a kids profile, When Home loads, Then the hero and rows are kids safe and cards are larger from 600 px and use 2.3 per row on a phone like the adult rows (R11).
- Edge: the paused and reduced motion states look intentional, not broken.
- Error: see AC2 and M05-S08.
- Empty: see M05-S07.

### M41-S16 Hero slide text (Should)
As an admin, I want to change a slide's headline, line and button label, so that a title is introduced my way.
- AC1: Given a hero slot, When I enter a headline, a description or a button label (80 characters each), Then Home uses them for that slide.
- AC2: Given they are blank, When Home loads, Then the title and its description are used.
- Edge: Play on a series still plays the next unwatched episode.
- Error: over 80 characters shows the limit.
- Empty: not applicable.

### M41-S17 Admin preview matches Home (Should)
As an admin, I want the curation preview to show the hero fallback, clip badges and View all links, so that I trust what I publish.
- AC1: Given the preview pane, When I change anything, Then it updates within 1 second for desktop and mobile widths.
- AC2: Given no hero titles, When the preview renders, Then the fallback titles show with a note.
- AC3: Given a section, When the preview renders, Then its View all text shows.
- Edge: the preview never plays video.
- Error: a preview failure does not block editing.
- Empty: "Nothing to preview yet."

### M41-S18 Upload your own clip (Could)
As an admin, I want to upload a short clip instead of a generated one, so that I control the exact moment.
- AC1: Given the Home preview card, When I upload an MP4 up to 8 MB and 15 seconds, Then the worker re encodes it with the standard settings and uses it.
- Edge: the uploaded file is never served as is.
- Error: a wrong type or too long file is refused with a plain message.
- Empty: not applicable.

### M41-S19 Viewer setting for previews (Could)
As a viewer, I want to turn hero previews off on my profile, so that Home stays still.
- AC1: Given Settings, When I switch Play previews off, Then no clip plays for that profile on any device.
- Edge: Data saver on implies off.
- Error: not applicable.
- Empty: not applicable.

### M41-S20 Restore launch defaults (Should)
As an admin, I want a button that brings back the launch layout, so that I can undo experiments.
- AC1: Given `/admin/home`, When I press Restore launch defaults and confirm, Then the draft becomes the seeded layout and Publish applies it.
- Edge: the live layout stays until I publish.
- Error: failure changes nothing.
- Empty: not applicable.

### M41-S21 Generate previews for all videos (Should)
As an admin, I want one button that makes the hero clips for every video already on the site, so that videos published before clips existed show one without me opening each.
- AC1: Given `/admin/home` as an admin, When I press Generate previews for all videos, Then every published, ready video with its original and a mode other than Off that has no clip, a failed or skipped one, a clip made before sound and a recorded length existed, a clip whose length no longer matches the setting, or a job stuck for over an hour is queued, and I read how many were queued and how many already had a current clip.
- AC2: Given I press it again, When nothing changed, Then nothing is queued twice and the message says nothing to queue.
- AC3: Given I am an Editor, When I open `/admin/home`, Then the button is disabled with "Only admins can do this", and the service refuses the call.
- AC4: Given it ran, When I open the audit log, Then one `video.preview_backfill` entry names who pressed it and how many were queued.
- Edge: at most 500 videos are queued per press, pressing again carries on; videos set to Off, unpublished, deleted or without an original are left out.
- Error: a failure says "That did not work. Nothing was queued. Try again." and changes nothing.
- Empty: with no eligible video the message says nothing to queue.

### M41-S22 Hero clip sound button (Should)
As a viewer, I want to hear the clip on the featured title when I choose to, so that I can follow what the video says without opening it.
- AC1: Given a slide with a clip that has sound, previews allowed and reduced motion off, When the clip plays, Then it plays muted and a button reading Unmute (icon and word, 44 px, `aria-pressed` false, accessible name "Unmute preview sound") sits just left of Pause.
- AC2: Given I press Unmute (a tap, so the browser allows sound), When the clip carries on, Then it has sound, the button reads Mute with `aria-pressed` true, and a polite status says "Sound on"; pressing Mute silences it and the status says "Sound off".
- AC3: Given I chose sound, When the slide changes, Then the next clip starts with the same choice and the button stays Mute; if the browser refuses sound the clip plays muted and the button reads Unmute again.
- AC4: Given the tab hides or I leave the page by reloading, When I come back, Then the clip is muted and the button reads Unmute; the choice is kept in memory only and writes no browser storage.
- AC5: Given a Kids profile or the Kids audience, reduced motion, Data saver, a slow link, a clip made before sound existed, or a clip that failed, When Home shows, Then there is no sound button.
- AC6: Given the site setting Sound button on hero clips is off, When Home loads, Then there is no sound button and clips stay muted.
- AC7: Given keyboard use, When I Tab to the button, Then it shows the dark focus ring (3 px, 2 px offset) and Enter or Space toggles it; Pause stops rotation and the clip together and leaves the button usable.
- Edge: a slide with no sound leaves the button's slot empty so Pause and the arrows never move; a single slide with a clip still offers the button.
- Error: a refused or failed clip removes the button and the still stays.
- Empty: a slide with no clip shows no button.

---

## M46 Languages

### M46-S01 Choose my language (Must)
As a viewer, I want to switch the interface to Yoruba, Igbo, Hausa or Pidgin without signing in, so that I can understand the site.
- AC1: Given more than one language is enabled, When I open the language control, Then I see each language by its own name with the English name beneath, and the current one is marked.
- AC2: Given I am a guest, When I choose Yorùbá, Then the page re-renders in Yorùbá without a full reload and the choice is kept in the `ad_locale` cookie.
- AC3: Given I am signed in with a profile, When I choose a language, Then it is saved on that profile and the cookie is also set.
- AC4: Given only English is enabled, When I look for the control, Then it is not shown.
- AC5: Given a screen reader, When the language changes, Then a polite announcement says "Language changed to Yorùbá" in the new language, and `<html lang>` updates.
- Edge: a kids profile does not show the control; the parent sets the language in the profile form. `?lang=yo` in a link sets the language for the visitor.
- Error: save failure keeps the cookie choice and shows "We could not save your language. It will apply on this device."
- Empty: not applicable.

### M46-S02 My language is remembered and guessed sensibly (Must)
As a viewer, I want the site to start in my language, so that I do not hunt for the switch.
- AC1: Given I have no cookie and my browser prefers `yo-NG` and Yoruba is enabled, When I open the site, Then it renders in Yoruba with no prompt.
- AC2: Given order of precedence, When several apply, Then query, then profile, then account, then cookie, then browser language, then the site default decide.
- AC3: Given a locale that is not enabled, When it would otherwise win, Then it is skipped.
- AC4: Given I sign out on a shared device, When the next person opens the site, Then the cookie language applies, not my profile.
- Edge: invalid cookie values and unknown `lang` values are ignored.
- Error: not applicable.
- Empty: not applicable.

### M46-S03 Missing translations show in English (Must)
As a viewer, I want a half translated language to stay usable, so that I am never shown a blank or a raw key.
- AC1: Given a key has no approved translation, When the screen renders, Then that string shows in English and the rest stays in my language.
- AC2: Given a key is missing everywhere, When rendered, Then the key itself is never shown to viewers (English text exists for every key by the coverage test).
- AC3: Given a language is below 100 percent, When I open the picker, Then a line says "Some text is still in English."
- Edge: a stale translation (English changed later) still shows until reviewed.
- Error: a failure to load the catalog shows English for the page.
- Empty: not applicable.

### M46-S04 Letters and tone marks display correctly (Must)
As a Yoruba or Igbo reader, I want ẹ ọ ị ụ ṣ ṅ and tone marks to draw properly in every font the admin can pick, so that words are not wrong or ugly.
- AC1: Given any of the six theme fonts, When Yoruba or Igbo text shows, Then every character comes from the chosen family or from Inter, never a random system font.
- AC2: Given English pages, When they load, Then no extra font file is downloaded.
- AC3: Given stacked marks (a dot below with a tone mark above) in headings, When rendered at the hero size, Then nothing is clipped.
- AC4: Given captions in Yoruba, When shown in the player, Then marks render with the same rule.
- Edge: text is stored and compared as NFC; decomposed input is normalised.
- Error: a font file that fails to load falls back per glyph to Inter, then the system font.
- Empty: not applicable.

### M46-S05 Numbers, dates, durations and plurals follow my language (Should)
As a viewer, I want "6 min", "17 Nov 2026" and "1 video" style text to read naturally, so that nothing looks half translated.
- AC1: Given a language, When a count shows, Then the plural form follows that language's rules (Yoruba and Igbo use one form for all counts).
- AC2: Given a duration, When shown, Then the words for minute and hour come from the catalog ("6 min" in English).
- AC3: Given a date, When shown, Then month names come from the locale when its data exists, else English, in the pattern "17 Nov 2026".
- AC4: Given the naira sign, When shown, Then it is the real ₦ with thousands separators.
- Edge: "Today" and "Yesterday" come from the catalog.
- Error: an engine without locale data falls back to `en-NG` formatting.
- Empty: not applicable.

### M46-S06 See and publish interface languages (Must)
As an admin, I want one screen to see how complete each language is and turn it on, so that I only publish what is ready.
- AC1: Given `/admin/languages`, When it loads, Then I see one row per language with state (Off, Draft, Live), approved percent, missing, stale, in review and last change.
- AC2: Given a language is below the publish threshold (default 80 percent of core keys), When I try to switch it Live, Then the switch is disabled with "Needs 80 percent of core text approved. Now 42 percent."
- AC3: Given a Super admin, When they override the threshold with a reason, Then the language goes Live and the override is audited.
- AC4: Given I switch a language Off, When viewers load a page, Then it renders in the fallback language and saved choices for that language are treated as unset.
- Edge: English cannot be switched off.
- Error: load failure shows retry inside the table area.
- Empty: "Only English is set up. Choose a language to start translating."

### M46-S07 Translate in the workspace (Must)
As an admin or editor, I want to translate text side by side with the English, so that I can work quickly and safely.
- AC1: Given `/admin/languages/yo`, When it loads, Then each row shows key, English, an editable translation, status and placeholder chips, with filters Missing, Stale, In review, Approved and an area filter and search.
- AC2: Given I edit a row, When I save, Then it becomes a draft, validation runs (placeholders, plural forms, no dashes, plain text) and errors show under the field.
- AC3: Given a plural key, When I open it, Then only the forms that language uses are shown.
- AC4: Given an Admin, When I approve rows, Then they take effect for viewers on the next request; Editors can save but not approve.
- AC5: Given I select many rows, When I bulk approve, Then a confirmation shows the count and a warning about rows with warnings.
- Edge: Copy English is offered for names and brand words; the character count warns above 2.5 times the English.
- Error: save failure keeps my text and offers Retry.
- Empty: "Everything in this language is approved."

### M46-S08 Export and import translations (Must)
As an admin, I want to send a spreadsheet to a volunteer and import it back, so that people without accounts can help.
- AC1: Given a language, When I choose Export, Then I can download CSV (UTF-8 with a BOM so diacritics survive Excel) or JSON with key, area, English, translation, status and note.
- AC2: Given an edited file, When I import it, Then a dry run shows added, changed, unchanged and rejected rows with a reason per rejected row before I confirm.
- AC3: Given I confirm, When the import runs, Then rows become In review (never Approved) in one transaction and the import is audited.
- AC4: Given a file over 2 MB or 5,000 rows, When I choose it, Then it is refused with the limit stated.
- Edge: decomposed characters are normalised; blank translations are ignored.
- Error: a malformed file shows the first problem and changes nothing.
- Empty: not applicable.

### M46-S09 Translation status and stale text (Should)
As an admin, I want to know which translations need a second look after English changed, so that meaning does not drift.
- AC1: Given English text changed after it was translated, When I open the workspace, Then the row shows "Source changed" with the old and new English.
- AC2: Given a stale row, When I choose Still correct, Then the hash is updated and the badge clears; When I edit and approve, Then the same.
- AC3: Given viewers, When a row is stale, Then they keep seeing the existing approved translation.
- Edge: the Languages table shows the stale count.
- Error: not applicable.
- Empty: not applicable.

### M46-S10 Missing key report (Should)
As an admin, I want to see which English strings viewers actually met in my language, so that I translate the most seen text first.
- AC1: Given the Missing tab, When it loads, Then keys are listed by hits with last seen date and area.
- AC2: Given I tap a key, When opened, Then the workspace shows that row.
- AC3: Given a key is approved, When viewers next load it, Then it drops off the report.
- Edge: bots and prefetch are not counted; counts are batched, not per request.
- Error: a recording failure never affects the page.
- Empty: "No missing text has been seen yet."

### M46-S11 Add a machine translation of captions (Must)
As an admin, I want to create a draft translation of approved captions, so that reviewers start from a draft instead of a blank page.
- AC1: Given a video with an approved track in its spoken language, When I choose Add translation and pick a language, Then a dialog shows the estimate (characters and cost, or minutes on this server) and a Start button.
- AC2: Given I start, When the job runs, Then a draft track is created in that language with the same timings, `in_review`, Publish off, and a notification "Translation ready to review" appears.
- AC3: Given the provider is not configured or does not support the language, When I open the dialog, Then it says so in plain words and offers uploading a caption file instead.
- AC4: Given a monthly character cap is set for an API provider, When a job would cross it, Then it is refused before any text is sent.
- Edge: only Editors and above can start jobs; viewers can never trigger a translation; glossary terms (platform and program names) are kept unchanged.
- Error: a failed job shows Retry and the plain reason.
- Empty: not applicable.

### M46-S12 Review a translated track side by side (Must)
As a reviewer, I want to read the English cue next to the translated cue, so that I can correct meaning and fit.
- AC1: Given `/admin/captions/[videoId]?lang=yo`, When it loads, Then tabs list the video's languages, the video overlay shows the Yoruba cue, and each row shows the English cue beside the translated one.
- AC2: Given timing, When I open a translated track, Then time fields are locked until I choose Unlock timing, which warns that it differs from the source.
- AC3: Given edits, When I leave a tab with unsaved changes, Then I am warned; autosave, undo and find and replace work as in M15-S05 and S06.
- AC4: Given warnings (line too long, more than 2 lines), When I approve, Then I confirm them as in M15-S07.
- Edge: marks type correctly on a Yoruba keyboard and survive save.
- Error: save failure shows Retry as in M15-S05.
- Empty: a language with no track shows Add translation.

### M46-S13 Publish a caption language (Must)
As an admin, I want to decide when a language goes live, so that nothing unreviewed reaches viewers.
- AC1: Given an approved translated track, When I switch Publish on for this video and language, Then viewers can pick it from the next playback.
- AC2: Given an unapproved track, When I look at the switch, Then it is disabled with "Approve this track first."
- AC3: Given Captions settings, When I switch a language off for the whole site, Then it disappears from every player at once, and switching it on restores the published tracks.
- AC4: Given "Source changed" on a track, When I look at the list, Then I can Retranslate or choose Still correct; viewers keep the approved track meanwhile.
- Edge: every change is audited with the actor.
- Error: save failure restores the switch and shows Retry.
- Empty: not applicable.

### M46-S14 The player lists only approved languages (Must)
As a viewer, I want the caption menu to show only languages I can trust, so that I do not read a draft.
- AC1: Given a video with English approved and Yoruba approved and published, When I open the caption menu, Then I see Off, English and Yorùbá, by their own names.
- AC2: Given Hausa is a draft or unpublished, When I open the menu, Then Hausa is absent.
- AC3: Given my profile caption language is Yoruba and the track exists, When I start the video, Then Yoruba is chosen; otherwise the interface language; otherwise English.
- AC4: Given the Yoruba file fails to load, When playback continues, Then English captions are used with the toast "That language could not load. Showing English."
- Edge: the title page CC badge counts only published tracks.
- Error: as AC4.
- Empty: a video with no published tracks has no CC button.

### M46-S15 Spoken language and detection (Must)
As an admin, I want to say what language a video is spoken in, so that captions come out in that language.
- AC1: Given the video details form, When I choose Spoken language (English, Yoruba, Hausa, Pidgin, Igbo, Auto), Then it is saved and used by the caption job.
- AC2: Given Auto, When the job runs, Then the detected language and confidence are noted; at or above 0.6 the video is updated, below it the review note says "Spoken language uncertain, check the captions".
- AC3: Given Yoruba or Hausa on a server without the multilingual model, When I generate, Then I see "This server only recognises English. Upload a caption file or align a script." and no English transcription is made.
- AC4: Given Igbo, When I open Captions, Then generation is not offered and Upload is.
- AC5: Given Pidgin, When generation runs, Then it is decoded as English and the review note says so.
- Edge: the publish gate checks the spoken language track.
- Error: a failed job shows Retry as in M15-S01.
- Empty: not applicable.

### M46-S16 Translate and approve in bulk (Should)
As an admin, I want to translate a whole library into one language, so that I do not click each video.
- AC1: Given Captions list, When I choose "Translate approved videos into Hausa", Then a dialog shows how many videos, characters, cost or time, and I confirm.
- AC2: Given the jobs, When they run, Then they run one at a time and the list shows progress per video.
- AC3: Given reviewed translations, When I select several and bulk approve, Then a dialog shows the count and a warning about rows with warnings.
- AC4: Given many approved tracks, When I choose Publish on for selected, Then they are published in one action and audited once per track.
- Edge: videos without an approved source are skipped with a count.
- Error: partial failure shows which failed and a Retry for those.
- Empty: "No videos are ready to translate."

### M46-S17 Translation engine and cost guard (Should)
As the super admin, I want to see which translation engine is configured and how much has been used, so that costs stay in check.
- AC1: Given `/admin/languages`, When I open Engine, Then I see provider name, state (Configured, Not configured), supported languages and this month's characters against the cap. The key itself is never shown.
- AC2: Given an API provider and a cap, When usage reaches 80 percent, Then a notice appears; at 100 percent new jobs are refused.
- AC3: Given the self hosted engine, When the sidecar is unreachable, Then the page says so and jobs wait for retry.
- Edge: Pidgin shows "Written by people. No engine drafts this language" unless the LLM option is configured.
- Error: usage cannot load shows retry.
- Empty: provider none shows "Machine translation is off. You can still upload translated caption files."

### M46-S18 Emails and the offline page in my language (Could)
As a viewer, I want the offline page and account emails in my language, so that important messages are understood.
- AC1: Given I am offline, When the offline page shows, Then it uses my stored language and falls back to English.
- AC2: Given an account email, When sent, Then it uses my account language and falls back to English per key.
- Edge: subjects follow the same copy rules and carry no dashes.
- Error: not applicable.
- Empty: not applicable.

### M46-S19 Pseudo language for layout checks (Could)
As a developer, I want a pseudo language that lengthens text and uses the hard letters, so that I can check layout and fonts without a translator.
- AC1: Given `DEV_PSEUDO_LOCALE` is on, When I pick the pseudo language, Then every string is about 40 percent longer with ẹ ọ ṣ ị ụ and tone marks, placeholders intact.
- AC2: Given production, When the flag is set, Then startup refuses it.
- Edge: the font coverage test uses the pseudo output.
- Error: not applicable.
- Empty: not applicable.

Counts: 19 new stories in M46 (Must: S01, S02, S03, S04, S06, S07, S08, S11, S12, S13, S14, S15; Should: S05, S09, S10, S16, S17; Could: S18, S19) plus 12 edits to existing stories and docs.
