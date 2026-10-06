# Passkey-First Sign-In Security

Date: 2026-09-07

Status: **planning only** — nothing in this document is implemented. Implementation happens on a
`feature/passkey-first-security` branch off `develop`; this document was drafted on `develop` and is
meant to be committed with the first implementation commit (or on its own as `docs(auth): ...`).

## Summary

- A user-verified passkey sign-in is a complete sign-in for **every** user, admins included. No
  authenticator app has to be enrolled and no code is asked for.
- Every other sign-in method — magic link, email/password, company Google — needs a second factor.
  The authenticator app (TOTP or a backup code) and a passkey are **peers**: either one confirms the
  sign-in.
- A user with no second factor at all (a freshly activated invitation, or a member whose factors an
  admin reset) is sent to security setup and picks a passkey or an authenticator app. Registering
  the first passkey completes the current session on the spot, no second sign-in.
- The admin-only authenticator requirement, its `reason=admin-totp-required` redirect and every
  string that mentions it are removed. Admins and members follow one rule.
- The app states plainly, everywhere the choice is offered, that a passkey signs you in on its own
  and that the authenticator app is only ever asked for after a non-passkey sign-in.
- Recovery gap closed: admins get **Reset passkeys** next to **Reset authenticator**, because under
  the new rule a passkey-only member who loses the device cannot finish any other sign-in.

## Why

Today an admin who signs in with a passkey is still bounced from every `/admin/*` route to
`/settings?setup=required&reason=admin-totp-required` until TOTP is enrolled — even though the
passkey login already skipped the code challenge. The requirement predates passkey support as a
first-class factor (`docs/auth-user-management.md`, "Admins should be required to enable TOTP before
using back-office management features").

At the same time the rule for members is _weaker_ than intended: a member with only a passkey who
signs in with a magic link gets no second-factor step at all, because the challenge is only raised
when `twoFactorEnabled` is true.

The change makes a passkey what it is meant to be — possession plus device verification in one step
— and closes the member gap with the same rule.

## Today

| Situation                                       | Member                                 | Admin                                               |
| ----------------------------------------------- | -------------------------------------- | --------------------------------------------------- |
| Nothing enrolled, any sign-in                   | `/settings?setup=required`             | same                                                |
| Passkey only, **passkey** sign-in               | active                                 | app opens, every `/admin/*` → `admin-totp-required` |
| Passkey only, magic link / password / Google    | **active, no second factor**           | app opens, `/admin/*` → `admin-totp-required`       |
| TOTP only, magic link / password / Google       | `/two-factor` (code or backup code)    | same                                                |
| TOTP + passkey, **passkey** sign-in             | active (passkey marker skips the code) | active                                              |
| TOTP + passkey, magic link / password / Google  | `/two-factor` (code or backup code)    | same                                                |
| Trusted device (30 days) after a TOTP challenge | active                                 | active                                              |

Where this lives:

- `src/server/auth/app-access.ts` — `getAppAccessState` decides `second_factor_required`
  (only when `twoFactorEnabled`) and `security_setup_required` (no TOTP and no passkey).
  `requireAdminAppMember` / `requireAdminAppMemberForAction` add the admin-only
  `!twoFactorEnabled` check. 15 pages and route handlers and 37 actions call those two helpers;
  none of them checks TOTP itself.
- `src/server/auth/second-factor.ts` — the app's own signed `sheet_happens_2fa` cookie, set by
  `verifySecondFactorAction` after a TOTP or backup-code verification; session-bound for 7 days, or
  device-bound for 30 days when "trust this device" was ticked.
- `src/server/auth/passkey-second-factor.ts` — a `verification` row keyed by the hashed session
  token, written from `databaseHooks.session.create.after` in `src/server/auth/auth.ts` when the
  session was created by `/passkey/verify-authentication`. This is how a passkey login already
  skips the code challenge.
- `src/server/auth/auth.ts` — the passkey plugin rejects assertions without user verification
  (`PASSKEY_USER_VERIFICATION_REQUIRED`); `twoFactor({ allowPasswordless: true })`.
- Better Auth's two-factor plugin only intercepts `/sign-in/email` (password). Magic link, Google
  and passkey sessions are created directly and the app-level gate raises the challenge. For a
  password sign-in with TOTP enabled the plugin deletes the just-created session, sets a signed
  `better-auth.two_factor` cookie (a random identifier whose `verification` row holds the user id,
  600 s) and returns `twoFactorRedirect: true`; the user is _anonymous_ on `/two-factor` until
  `verifyTOTP` / `verifyBackupCode` creates the session.
- `app/settings/page.tsx` — `adminTotpRequired` drives the setup banner and its two admin strings.
- `app/two-factor/` — challenge page: authenticator / backup-code tabs, trust-device checkbox.
- Wording that encodes the old rule: `Settings.setupBanner.adminTotpDescription`,
  `Settings.setupBanner.adminTotpHint`, `Settings.totp.footer`, plus softer places listed in §7.
- `docs/manual-qa-test-plan.md` "Admin TOTP Gate", "Passkey Login", "Disable Authenticator App";
  `docs/auth-user-management.md` 2FA and passkey rules; `docs/mcp-server.md` three mentions of
  "TOTP-gated admins"; `.env.example` comment on `AUTH_SECURITY_SETUP_MODE`.

## Decisions

Recorded from the planning conversation on 2026-09-07:

1. **Scope: everyone.** One rule for admins and members. Members who today rely on passkey-only plus
   magic link will meet the second-factor step on their next non-passkey sign-in.
2. **Passkey and authenticator are peers.** After a magic-link, password or Google sign-in the
   challenge accepts a passkey, an authenticator code or a backup code — whatever the user has. A
   user with neither is sent to security setup, which offers both and says that a passkey alone is
   enough to sign in.
3. **The first passkey registration counts.** Registering a passkey is a user-verified WebAuthn
   ceremony inside a fresh session; it is recorded the same way a passkey login is, so onboarding
   ends without a second sign-in.

Alternatives considered and set aside:

- _Block passkey-only users from non-passkey sign-ins_ ("use your passkey"). Strongest against email
  compromise, but every lost device becomes an admin ticket and there was no admin passkey reset.
- _Force authenticator enrolment when a passkey-only user signs in without it._ Literal reading of
  "authenticator mandatory", but weaker for admins than today (email access alone could enrol a
  second factor) and it makes the authenticator a hard requirement for passkey users after all.
- _Admins only._ Keeps the member gap open and keeps two rules to explain.

## Target policy

Definitions, all evaluated per request inside `getAppAccessState`:

- **Enrolled** — `twoFactorEnabled` is true, or the user has at least one passkey row.
- **Strong session** — any of:
  - the session was created by `/passkey/verify-authentication` (existing marker), or
  - a passkey was registered in this session via `/passkey/verify-registration` (new marker, same
    table and shape), or
  - the app's second-factor cookie is valid for this user **and** `twoFactorEnabled` is still true
    (a session-bound cookie must also match this session's token; a trusted-device cookie need not).

Gate, in order:

```text
not enrolled            → security_setup_required   (dev override: active)
enrolled, not strong    → second_factor_required
enrolled, strong        → active
```

Roles never enter the gate. `requireAdminAppMember` and `requireAdminAppMemberForAction` keep only
the role check.

| Sign-in method                     | Nothing enrolled | Passkey only           | Authenticator only     | Both                              |
| ---------------------------------- | ---------------- | ---------------------- | ---------------------- | --------------------------------- |
| Passkey                            | —                | active                 | —                      | active                            |
| Magic link / Google                | setup            | `/two-factor`: passkey | `/two-factor`: code    | `/two-factor`: passkey or code    |
| Password, `twoFactorEnabled` false | setup            | `/two-factor`: passkey | —                      | —                                 |
| Password, `twoFactorEnabled` true  | —                | —                      | plugin redirect → code | plugin redirect → passkey or code |
| Any, trusted device still valid    | setup            | `/two-factor`: passkey | active                 | active                            |

"Passkey" on `/two-factor` means a full passkey sign-in from that page: it creates a new session
that carries the passkey marker and replaces the weak one in the browser.

## Implementation plan

### 1. Access policy — `src/server/auth/app-access.ts`

- Extract the decision into a pure module, following `member-session-policy.ts`:
  `src/server/auth/security-gate-policy.ts` exporting

  ```ts
  export type SecurityGateInput = {
    twoFactorEnabled: boolean;
    passkeyCount: number;
    secondFactorCookieSatisfied: boolean; // sheet_happens_2fa valid for this user/session
    passkeySessionVerified: boolean; // marker from passkey sign-in or registration
    securitySetupOptional: boolean; // isSecuritySetupOptionalInDev()
  };
  export function resolveSecurityGate(
    input: SecurityGateInput,
  ): "active" | "second_factor_required" | "security_setup_required";
  ```

  with `security-gate-policy.test.ts` beside it (cases in §Verification).

- `getAppAccessState` computes the inputs and calls it. Keep the cookie check before the marker
  query and only run either when the user is enrolled. Delete `hasCompletedSecuritySetup` and
  `hasSatisfiedStrongAuthentication`; the policy owns both.
- `requireAdminAppMember` and `requireAdminAppMemberForAction`: remove the `!twoFactorEnabled`
  branches and the `"Authenticator app setup is required for admin actions."` error. `securitySetupRoute`
  keeps its optional `reason` parameter for now (nothing passes one any more); remove it once no
  caller is left.
- `AppAccessState`, its status names, `AppAuthUser`, `sanitizeCallbackURL`, and all route helpers
  are unchanged, so the 15 pages and 37 actions need no edits.

### 2. Session strength markers — `src/server/auth/auth.ts`, `passkey-second-factor.ts`

- **Registration counts.** Extend the existing `hooks.after` (currently audit-only for
  `/passkey/verify-registration`): the endpoint runs behind `freshSessionMiddleware`, so
  `ctx.context.session` is the onboarding session. Call
  `createPasskeySecondFactorSessionMarker({ userId, sessionToken: session.token, expiresAt: session.expiresAt })`
  next to `auditPasskeyAdded`. The marker's identifier prefix and lookup are shared with the sign-in
  marker; `hasPasskeySatisfiedSecondFactor` needs no change. Rename the file's comments from "passkey
  login" to "passkey ceremony" so the two sources are visible.
- **Second-factor cookie only while TOTP is enrolled.** No change to `second-factor.ts` itself; the
  policy ANDs `twoFactorEnabled` in. This closes a stale trusted-device cookie letting a
  passkey-only user through after an admin TOTP reset.
- **Optional hygiene: supersede the weak session on a passkey sign-in from `/two-factor`.** In a new
  `hooks.after` branch for `/passkey/verify-authentication`, read the request's _previous_ session
  with `getSessionFromCtx(ctx, { disableRefresh: true })` (it returns `ctx.context.session` first,
  which the passkey endpoint never sets, then resolves from request cookies), compare with
  `ctx.context.newSession`, and `ctx.context.internalAdapter.deleteSession(previous.session.token)`
  when both belong to the same user and differ. Verify against the installed 1.7 source before
  relying on it; if `getSessionFromCtx` turns out to return the new session, drop this step — the
  orphaned row is unreachable (the browser cookie was replaced) and expires with the session TTL.
- Nothing else in `auth.ts` changes: user-verification enforcement, rate limits, `allowPasswordless`.

### 3. Second-factor challenge — `app/two-factor/`

- `page.tsx` resolves which factors to offer:
  - `second_factor_required` (signed in, weak session): `authUser.twoFactorEnabled` and
    `authUser.passkeyCount > 0` from `getAppAccessState`.
  - anonymous with a pending plugin challenge (password flow): TOTP is certainly enrolled (the
    plugin only redirects such users). Offer the passkey option too, unconditionally: looking the
    user up would mean parsing the plugin's signed cookie, and a passkey attempt with no passkey
    fails with a translated error. (Refinement, only if the unconditional button proves confusing:
    parse the identifier from the `better-auth.two_factor` cookie, read its `verification` row for
    the user id, count passkeys.)
- `TwoFactorChallengePanel.tsx` gets `methods: { totp: boolean; passkey: boolean }`:
  - passkey available → a hero "Continue with passkey" button at the top (same treatment as
    `LoginPanel`), then an "or" divider, then the existing tabs when TOTP is available;
  - passkey only → no tabs, no trust-device checkbox (a passkey session needs none), description
    "Confirm this sign-in with your passkey";
  - TOTP only → unchanged;
  - the passkey action calls `authClient.signIn.passkey()` and on success navigates to
    `callbackURL`; errors map 429 → rate-limited, otherwise the passkey-incomplete message.
  - "Use another sign-in" link stays.
- `actions.ts` is unchanged: TOTP and backup codes still set the app cookie; the passkey path never
  reaches a server action.
- Accessibility: keep the single `h1`; the passkey button gets a stable name so an aria baseline can
  pin it later (see follow-ups).

### 4. Settings — `app/settings/page.tsx`, `SecuritySettingsClient.tsx`

- Delete `adminTotpRequired` and its two banner branches. New banner logic:
  `showSetupBanner = access.status === "security_setup_required" || setupParam === "required"`,
  `complete = access.status === "active"`. The legacy `reason` query parameter is ignored, so old
  links and bookmarks still land somewhere sensible.
- Banner copy (§7) explains the two choices and the passkey-alone rule. Keep the "Continue" button
  for the complete state; after the first passkey is added, `router.refresh()` already re-renders
  the page and, with the registration marker, the banner flips to complete without a re-login.
- `SecuritySettingsClient.tsx`: no behavioural change. Wording of the passkeys and authenticator
  cards and the method list (§7). Optional polish: a "Second factor" row in the posture card showing
  passkey / authenticator / both / not set.
- `actions.ts`: `auditTotpDisabledAction` keeps clearing the app cookie. Disabling TOTP while a
  passkey exists now leaves a weak session only if the current session was not a passkey ceremony —
  the gate then asks for the passkey on the next request, which is correct. Removing the last
  passkey with no TOTP sends the user to setup, as today.

### 5. Login — `app/login/LoginPanel.tsx`

- Copy only: the passkey button's hint states that no authenticator code is needed (§7). Flow is
  unchanged.

### 6. Admin recovery: Reset passkeys — `src/server/users/lifecycle.ts`, `app/admin/people/`

Required by decision 2: a passkey-only member who loses every device holding the passkey can start a
magic-link sign-in but cannot finish `/two-factor`. Mirror the existing authenticator reset:

- `lifecycle.ts`: `resetMemberPasskeys(input, deps)` — resolve the member and linked auth user,
  `passkey.deleteMany({ userId })`, `revokeAuthSessionsForMember(..., reason: "admin_revoke")`,
  audit `security.passkeys_reset` with `before.passkeyCount` and `after.revokedSessionCount` only
  (never credential ids or public keys). Same self-reset guard as `resetMemberTotp`. Extend the
  `MemberLifecycleDb` test double type with `passkey.deleteMany`.
- `app/admin/people/actions.ts`: `resetMemberPasskeysAction(memberId)` via `runAdminPeopleAction`.
- `AdminPeopleTable.tsx`: row action "Reset passkeys" and a `ResetPasskeysDialog` beside
  `ResetTotpDialog`; pending key `"passkeys"`.
- Audit label derives from the action string, as `security.totp_reset` does; check the
  `app/admin/audit` label test if one asserts the option list.
- Not combining the two resets into one: a member who lost only a security key signs in with a code
  and deletes the passkey themselves; an admin resetting both is two clicks.

### 7. i18n — `messages/en.json` and `messages/hu.json`

Both locales change in the same commit; `src/i18n/messages.test.ts` guards key parity. HU keeps
the current informal register and vocabulary (passkey, authenticator alkalmazás, tartalék kód,
mágikus link).

Remove:

| Key                                         | Reason               |
| ------------------------------------------- | -------------------- |
| `Settings.setupBanner.adminTotpDescription` | admin-only rule gone |
| `Settings.setupBanner.adminTotpHint`        | admin-only rule gone |

Change (EN draft; HU written alongside):

| Key                                                             | Draft                                                                                                                                                                                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Settings.setupBanner.memberDescription` → rename `description` | Add a passkey or set up an authenticator app to finish. A passkey signs you in on its own. If you sign in with an email link, a password, or Google instead, you confirm it with your passkey or an authenticator code. |
| `Settings.setupBanner.memberHint` → rename `hint`               | Use the passkey or authenticator-app controls below. You can add both.                                                                                                                                                  |
| `Settings.totp.footer`                                          | Codes are asked for after email-link, password, and Google sign-ins. Passkey sign-in never asks for a code.                                                                                                             |
| `Settings.totp.enabledDescription`                              | Email-link, password, and Google sign-ins ask for a 6 digit code from your authenticator app unless you confirm with a passkey.                                                                                         |
| `Settings.methods.totp.enabledDescription`                      | Confirms email-link, password, and Google sign-ins with a one-time code.                                                                                                                                                |
| `Settings.methods.totp.setupDescription`                        | Add one-time codes to confirm sign-ins made without a passkey.                                                                                                                                                          |
| `Settings.methods.passkeys.emptyDescription`                    | Use Touch ID, Face ID, Windows Hello, or a hardware security key. A passkey signs you in on its own, with no authenticator code.                                                                                        |
| `Settings.passkeys.description`                                 | Register device biometrics or hardware security keys. A passkey is a complete sign-in on its own and never asks for an authenticator code; it also confirms sign-ins made with an email link, a password, or Google.    |
| `Settings.passkeys.registeredDescription`                       | Remove passkeys you no longer recognize. Without a passkey, email-link, password, and Google sign-ins ask for an authenticator code — or for security setup if you have no authenticator app either.                    |
| `Login.actions.passkeyHint`                                     | Passwordless, no authenticator code needed                                                                                                                                                                              |
| `TwoFactor.description` (TOTP only)                             | unchanged                                                                                                                                                                                                               |

Add:

| Key                                           | Draft EN                                                                                                                                                                                                                                                                 | Draft HU                                                                                                                                                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TwoFactor.descriptionWithPasskey`            | Confirm with your passkey, an authenticator-app code, or a backup code.                                                                                                                                                                                                  | Erősítsd meg a passkey-eddel, egy authenticator alkalmazás kóddal vagy egy tartalék kóddal.                                                                                                                                                                                      |
| `TwoFactor.descriptionPasskeyOnly`            | Confirm this sign-in with your passkey.                                                                                                                                                                                                                                  | Erősítsd meg ezt a belépést a passkey-eddel.                                                                                                                                                                                                                                     |
| `TwoFactor.passkey.action`                    | Continue with passkey                                                                                                                                                                                                                                                    | Folytatás passkey-jel                                                                                                                                                                                                                                                            |
| `TwoFactor.passkey.hint`                      | Signs you in without a code                                                                                                                                                                                                                                              | Kód nélkül beléptet                                                                                                                                                                                                                                                              |
| `TwoFactor.or`                                | or                                                                                                                                                                                                                                                                       | vagy                                                                                                                                                                                                                                                                             |
| `TwoFactor.errors.passkeyIncomplete`          | Passkey verification was not completed.                                                                                                                                                                                                                                  | A passkey ellenőrzés nem fejeződött be.                                                                                                                                                                                                                                          |
| `TwoFactor.errors.rateLimited`                | Too many attempts. Please try again later.                                                                                                                                                                                                                               | Túl sok próbálkozás. Próbáld újra később.                                                                                                                                                                                                                                        |
| `AdminPeople.actions.resetPasskeys`           | Reset passkeys                                                                                                                                                                                                                                                           | Passkey-k visszaállítása                                                                                                                                                                                                                                                         |
| `AdminPeople.resetPasskeysDialog.title`       | Reset passkeys?                                                                                                                                                                                                                                                          | Visszaállítod a passkey-ket?                                                                                                                                                                                                                                                     |
| `AdminPeople.resetPasskeysDialog.titleNamed`  | Reset passkeys for {name}?                                                                                                                                                                                                                                               | Visszaállítod {name} passkey-jeit?                                                                                                                                                                                                                                               |
| `AdminPeople.resetPasskeysDialog.description` | This removes every passkey registered for the selected member, then revokes active sessions. They can sign in again with an email link, a password, or Google, confirm with their authenticator app if they have one, and register a new passkey from security settings. | Ez törli a kijelölt tag minden regisztrált passkey-jét, majd visszavonja az aktív munkameneteket. Újra beléphet e-mail linkkel, jelszóval vagy Google-fiókkal, megerősítheti az authenticator alkalmazásával, ha van, és új passkey-t regisztrálhat a biztonsági beállításokban. |
| `AdminPeople.resetPasskeysDialog.warning`     | Use this only when the member has lost every device that holds a passkey for this account.                                                                                                                                                                               | Csak akkor használd, ha a tag minden olyan eszközét elvesztette, amelyen passkey volt ehhez a fiókhoz.                                                                                                                                                                           |
| `AdminPeopleActions.success.passkeysReset`    | Passkeys reset.                                                                                                                                                                                                                                                          | Passkey-k visszaállítva.                                                                                                                                                                                                                                                         |
| `AdminPeopleActions.success.noPasskeys`       | This member had no passkeys.                                                                                                                                                                                                                                             | Ennek a tagnak nem volt passkey-je.                                                                                                                                                                                                                                              |

HU drafts for the changed keys, to keep the register consistent:

- `Settings.setupBanner.description`: "Adj hozzá egy passkey-t vagy állíts be authenticator
  alkalmazást a befejezéshez. A passkey önmagában beléptet. Ha e-mail linkkel, jelszóval vagy
  Google-fiókkal lépsz be, a passkey-eddel vagy egy authenticator kóddal erősíted meg."
- `Settings.setupBanner.hint`: "Használd az alábbi passkey vagy authenticator alkalmazásos
  vezérlőket. Mindkettőt hozzáadhatod."
- `Settings.totp.footer`: "A kódot e-mail linkes, jelszavas és Google belépés után kérjük. A passkey
  belépés soha nem kér kódot."
- `Settings.passkeys.description`: "Regisztrálj eszközös biometriát vagy hardveres biztonsági
  kulcsot. A passkey önmagában teljes belépés, authenticator kód nélkül; emellett megerősíti az
  e-mail linkes, jelszavas és Google belépéseket is."
- `Login.actions.passkeyHint`: "Jelszó és authenticator kód nélkül"

Unchanged on purpose: `AccountStatus.*` (no new state), `AdminPeople.resetTotpDialog.*` ("another
allowed method" is still true), MCP model-facing text (English only by rule).

### 8. Docs and environment

- `docs/auth-user-management.md` — rewrite "2FA Rules" and "Passkey Rules": passkey is a complete
  sign-in for all roles; TOTP or passkey confirms every other method; drop "Admins should be required
  to enable TOTP…" and "passkeys … must not satisfy admin 2FA by themselves"; document both markers
  and the `twoFactorEnabled` gate on the cookie; add Reset passkeys under admin actions and
  `security.passkeys_reset` under audit.
- `docs/mcp-server.md` — three edits: the "Same gates as the web" bullet ("Admin toolsets later
  should additionally require TOTP-enabled admins at consent" → "require the admin role at consent;
  the second-factor gate is already uniform"), the later-toolsets list ("TOTP-gated at consent" →
  "role-gated at consent"), and decision 13's "TOTP requirement at consent". No §18 entry: nothing
  about the installed packages changes.
- `.env.example` — the `AUTH_SECURITY_SETUP_MODE` comment drops "(incl. the admin TOTP
  requirement)".
- `CLAUDE.md` — nothing to add; the rule is in the code and the auth doc.

### 9. Manual QA plan — `docs/manual-qa-test-plan.md`

Separate commit, `docs(qa): ...`, per repo convention.

Update:

- "Activate Invited Account": adding only a passkey completes setup without signing in again; the
  banner names both options and says a passkey alone signs you in.
- "Magic-Link Login For Active User" and the Google sign-in gates bullet: three outcomes —
  nothing enrolled → `/settings?setup=required`; enrolled and untrusted → `/two-factor` offering
  passkey and/or code; trusted device → `/dashboard`.
- "Security Setup Gate": banner copy; first passkey flips it to complete.
- "Passkey Login": drop the admin caveat; a passkey-only admin opens `/admin/people`.
- "Passkey Login With TOTP Enabled": last bullet reads "shows `/two-factor` offering passkey or code".
- "Disable Authenticator App": drop "Admin users cannot use admin pages again until TOTP is
  re-enabled"; with a passkey left, non-passkey sign-ins ask for the passkey.
- "Remove Passkey": "Magic-link login remains available" → it asks for an authenticator code, or for
  setup when none is enrolled.

Replace "Admin TOTP Gate" with "Passkey-Only Admin Opens Admin Pages".

Add:

- "Passkey Confirms A Magic-Link Sign-In" (passkey-only user; `/two-factor` shows only the passkey
  option; completes to the callback URL).
- "Passkey Confirms A Password Sign-In With Authenticator Enabled" (plugin redirect; passkey option
  present next to the tabs; either completes).
- "Admin Reset Member Passkeys" (mirrors "Admin Reset Member Authenticator"; audit
  `security.passkeys_reset` without credential material; the member re-registers from settings).
- "Passkey-Only Member Without A Device Is Recovered" (magic link → `/two-factor` stuck → admin
  reset → magic link → setup).

## Edge cases and security notes

- **Email is still the root of trust at onboarding.** A freshly activated member enrols their first
  factor from a magic-link session; that is unchanged and inherent to invite-by-email.
- **Stale trusted-device cookie.** Gated on `twoFactorEnabled`, so an admin TOTP reset invalidates
  it for the gate even though the cookie itself lives up to 30 days.
- **Deleting the last passkey inside a passkey session.** Enrolment fails first, so the user lands
  on setup immediately (today's behaviour), even though the session is still strong.
- **Disabling TOTP with a passkey enrolled, from a magic-link session.** The cookie is cleared, the
  session is weak, the user has a passkey → next request goes to `/two-factor` with the passkey
  option. Reasonable, and only reachable from a session that already passed a code.
- **Registration freshness.** `/passkey/verify-registration` requires a fresh session (Better Auth
  `session.freshAge`; its documented default is one day, confirm against the installed version). Unchanged constraint; onboarding sessions are minutes old.
- **Orphaned weak session** after a passkey sign-in from `/two-factor`: see §2, optional cleanup.
- **Rate limits.** `/passkey/verify-authentication` is 10 per 15 minutes per IP; a challenge page
  retry loop is bounded by it. No change.
- **Dev override.** `AUTH_SECURITY_SETUP_MODE=optional` still means "nothing enrolled → active" and
  only that; an enrolled user with a weak session is challenged in dev too, as today. The e2e suite
  sets it and its users enrol nothing, so no e2e spec changes behaviour.
- **MCP tokens.** `src/server/mcp/actor.ts` deliberately re-checks only ACTIVE; `/consent` runs
  behind `requireActiveAppMember` and so inherits the new gate. No change.
- **No schema change, no migration.** Both markers reuse the `verification` table; `passkey` rows
  and `twoFactorEnabled` already exist.
- **Audit.** `security.passkey_added`, `security.totp_enabled`, `security.totp_disabled`,
  `security.totp_reset` unchanged; `security.passkeys_reset` added.

## Verification

Unit (`pnpm test src/server/auth/security-gate-policy.test.ts src/server/users/lifecycle.test.ts`):

- nothing enrolled → `security_setup_required`; with `securitySetupOptional` → `active`
- passkey only, marker → `active` (admin and member identical: the policy has no role input)
- passkey only, no marker, no cookie → `second_factor_required`
- TOTP only, cookie → `active`; TOTP only, no cookie → `second_factor_required`
- TOTP disabled, stale cookie → `second_factor_required` (passkey enrolled) or setup (not)
- both enrolled, either proof → `active`
- `resetMemberPasskeys`: deletes rows, revokes sessions, writes the audit row without credential
  fields, refuses self-reset, reports "had none" when count is zero

Then `pnpm verify:fast`, and `pnpm verify` before calling it done.

Browser, via `pnpm exec playwright cli` on `http://localhost:3000` (EN in a fresh browser):

- magic-link sign-in as a user with nothing enrolled → `/settings?setup=required` banner shows the
  new copy; enrol TOTP → "Continue" → `/admin/people` opens for the admin with no
  `admin-totp-required` redirect
- disable TOTP with no passkey → setup banner returns
- `/two-factor` for a user with a seeded passkey row and no TOTP renders only the passkey option
  (the ceremony itself cannot run headless without a virtual authenticator; see follow-ups)
- both locales: switch `sheet-happens-locale` and read the same screens in HU

Real device (manual QA plan): every passkey ceremony — onboarding with a passkey only, passkey as
second factor after magic link and after password, passkey-only admin opening admin pages.

## Rollout notes

- Existing admins keep working: those with TOTP see no change; those who were blocked by the admin
  gate are unblocked on their next passkey sign-in.
- Existing passkey-only members meet `/two-factor` with the passkey option on their next non-passkey
  sign-in. Worth one line in the release note.
- Trusted-device cookies issued before the change keep working while TOTP stays enrolled.
- No data migration, no feature flag. Revert is a code revert.

## Out of scope / follow-ups

- Passkey-first onboarding without a magic link (`docs/auth-user-management.md` already defers it).
- Sensitive-action re-authentication for admins (also deferred there).
- An e2e spec for the passkey paths using Chromium's virtual authenticator
  (`WebAuthn.addVirtualAuthenticator` over CDP) — would let `pnpm e2e` cover onboarding with a
  passkey and the passkey second factor; today `AUTH_SECURITY_SETUP_MODE=optional` skips the gate
  in the suite.
- An aria baseline for `/two-factor` once the passkey option exists.
- Posture-card "Second factor" row (§4, optional).

## Suggested commit sequence

1. `feat(auth): treat a passkey as a complete sign-in and a second factor` — §1, §2, §3, policy
   tests.
2. `feat(settings): drop the admin authenticator gate and reword security setup` — §4, §5, §7.
3. `feat(admin): reset member passkeys` — §6 and its tests, strings.
4. `docs(auth): record the passkey-first sign-in policy` — §8 (this document may ride along).
5. `docs(qa): cover passkey-first sign-in and passkey reset` — §9.
