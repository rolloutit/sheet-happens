# Manual QA Test Plan

This document is the shared manual test checklist for QA and PM validation. It assumes the app is
already deployed and reachable from a browser.

Replace placeholder values before sharing a concrete test run:

- `{DOMAIN_NAME}`: deployed app domain, for example `sheet.example.com`.
- `{ADMIN_EMAIL}`: active admin test user email.
- `{CONTRACTOR_EMAIL}`: active contractor test user email.
- `{EMPLOYEE_EMAIL}`: active employee test user email.
- `{ADMIN_INVITE_TOKEN}`: pending admin invitation token.
- `{CONTRACTOR_INVITE_TOKEN}`: pending contractor invitation token.
- `{INVALID_INVITE_TOKEN}`: deliberately invalid invitation token for negative testing.
- `{AUDIT_LOG_VIEW}`: audit-log viewer, admin export, or database access path for checking audit
  rows.
- `{INVITED_EMAIL}`: email address that owns the tested invitation.
- `{INVITED_FIRST_NAME}`: first name used when creating a new invited member.
- `{INVITED_LAST_NAME}`: last name used when creating a new invited member.
- `{INVITED_PROFILE}`: profile selected for a new invited member, for example contractor or employee.
- `{INVITED_ROLE}`: role selected for a new invited member, for example member or admin.
- `{INVITED_CURRENCY}`: default currency selected for a new invited member.
- `{INVITED_TIMEZONE}`: timezone selected for a new invited member.
- `{INVITED_LOCALE}`: locale selected for a new invited member.
- `{UNKNOWN_EMAIL}`: email address that is not a Sheet Happens member or pending invite.
- `{AUTHENTICATOR_APP}`: authenticator app used for TOTP testing.
- `{PASSKEY_DEVICE}`: passkey-capable test device or browser profile.

## General Rules

- Test in a clean browser profile or private window when the scenario mentions signed-out state.
- If a scenario expects email, use the mailbox for the email address named in the test data.
- Record the browser, operating system, user role, and date of the test run.
- Capture screenshots for failures and include the full URL, excluding secret tokens when sharing
  outside the project team.
- Do not reuse one-time backup codes across repeated test runs.
- When a scenario mentions audit rows, verify them through `{AUDIT_LOG_VIEW}` if the current test
  environment exposes audit-log access.

## Smoke: Deployment Is Reachable

### Steps

1. Open `https://{DOMAIN_NAME}`.
2. Wait for the page to finish loading.

### Expected Result

- The app redirects unauthenticated users to `https://{DOMAIN_NAME}/login?callbackURL=%2Fdashboard`.
- No blank page or server error is shown.

## Invitation Activation

Invitation acceptance links are valid for 72 hours. Resending an invitation should rotate the link
and start a fresh 72-hour window.

### Pending Invitation Opens Correctly

1. Open `https://{DOMAIN_NAME}/accept-invite?token={ADMIN_INVITE_TOKEN}` or
   `https://{DOMAIN_NAME}/accept-invite?token={CONTRACTOR_INVITE_TOKEN}`.
2. Confirm the page shows the invited email address.
3. Confirm the primary action offers to send an email sign-in link.

Expected result:

- The invitation page loads.
- The invited email matches `{INVITED_EMAIL}`.
- The page does not activate the account until the user signs in with the invited email.

### Activate Invited Account

1. Open `https://{DOMAIN_NAME}/accept-invite?token={ADMIN_INVITE_TOKEN}`.
2. Click `Email sign-in link`.
3. Open the email sent to `{INVITED_EMAIL}`.
4. Open the sign-in link from the email.
5. Confirm the invitation page now shows `Signed in as {INVITED_EMAIL}`.
6. Click `Activate account`.
7. Click `Continue`.

Expected result:

- The account activation succeeds.
- If the account has no passkey and no TOTP yet, the user is redirected to
  `https://{DOMAIN_NAME}/settings?setup=required...`.
- After adding a passkey or enabling TOTP, the user can open `https://{DOMAIN_NAME}/dashboard`.
- The member profile is active.
- Opening the same invitation link again shows that the invitation has already been accepted.

### Invitation Email Mismatch Is Blocked

1. Sign in as `{ADMIN_EMAIL}` or any account that is not `{INVITED_EMAIL}`.
2. Open `https://{DOMAIN_NAME}/accept-invite?token={CONTRACTOR_INVITE_TOKEN}`.
3. Try to activate the invitation.

Expected result:

- The page warns that the invitation belongs to a different email.
- The `Activate account` action is disabled or blocked.
- The member is not activated under the wrong auth account.

### Invalid Invitation Token

1. Open `https://{DOMAIN_NAME}/accept-invite?token={INVALID_INVITE_TOKEN}`.

Expected result:

- The page shows an invalid or unavailable invitation state.
- The app does not create or activate a user.

## Login

### Magic-Link Login For Active User

1. Start signed out.
2. Open `https://{DOMAIN_NAME}/login`.
3. Enter `{ADMIN_EMAIL}`.
4. Click `Email sign-in link`.
5. Open the email sent to `{ADMIN_EMAIL}`.
6. Open the sign-in link from the email.

Expected result:

- If 2FA is enabled, the user lands on `https://{DOMAIN_NAME}/two-factor?...`.
- If the user has no passkey and no TOTP yet, the user lands on `/settings?setup=required...`.
- Otherwise, the user lands on `https://{DOMAIN_NAME}/dashboard`.

### Unknown Email Does Not Reveal Account State

1. Start signed out.
2. Open `https://{DOMAIN_NAME}/login`.
3. Enter `{UNKNOWN_EMAIL}`.
4. Click `Email sign-in link`.

Expected result:

- The UI shows a neutral success-style message.
- No account existence information is revealed in the browser.
- No app session is created for `{UNKNOWN_EMAIL}`.

### Password Setup For Active User

1. Sign in as `{ADMIN_EMAIL}` or `{CONTRACTOR_EMAIL}`.
2. Open `https://{DOMAIN_NAME}/settings`.
3. In the `Email password` section, click `Send setup link` or `Send reset link`.
4. Open the email sent to the same account.
5. Open the password setup link.
6. Enter a new password with at least 12 characters.
7. Confirm the password.
8. Click `Update password`.

Expected result:

- The password is accepted.
- The page confirms that the password was updated.
- An audit row is recorded for `security.password_reset`.
- Existing sessions for that auth account are revoked.

### Password Login For Active User

1. Start signed out.
2. Open `https://{DOMAIN_NAME}/login`.
3. Enter `{ADMIN_EMAIL}` or `{CONTRACTOR_EMAIL}`.
4. Enter the password created in the previous test.
5. Click `Sign in with password`.

Expected result:

- If 2FA is enabled, the user lands on `https://{DOMAIN_NAME}/two-factor?...`.
- Otherwise, the user lands on `https://{DOMAIN_NAME}/dashboard`.
- Public sign-up is not available from the login screen.

### Password Reset For Unknown Email Is Neutral

1. Start signed out.
2. Open `https://{DOMAIN_NAME}/login`.
3. Enter `{UNKNOWN_EMAIL}`.
4. Click `Reset password`.

Expected result:

- The UI shows a neutral success-style message.
- No account existence information is revealed in the browser.
- No password reset email is sent to `{UNKNOWN_EMAIL}`.

### Company Google Login

Run this test only when Google auth is configured for `{COMPANY_GOOGLE_DOMAIN}`.

1. Make sure `{COMPANY_GOOGLE_EMAIL}` has already activated its invitation.
2. Start signed out.
3. Open `https://{DOMAIN_NAME}/login`.
4. Click `Continue with company Google`.
5. Choose `{COMPANY_GOOGLE_EMAIL}` in Google.

Expected result:

- Google sign-in succeeds only for the configured company Workspace domain.
- If this is the first Google sign-in for the activated account, the Google account is linked
  automatically.
- The user is then routed through the normal app gates: `/two-factor`, `/settings`, or `/dashboard`.

### Private Google Login Is Blocked

Run this test only when Google auth is configured.

1. Start signed out.
2. Open `https://{DOMAIN_NAME}/login`.
3. Click `Continue with company Google`.
4. Choose `{PRIVATE_GOOGLE_EMAIL}` or any Google account outside `{COMPANY_GOOGLE_DOMAIN}`.

Expected result:

- Google sign-in is rejected or returns to the login screen.
- No Sheet Happens auth account is created.
- No domain member is activated or linked to the private Google account.

## Protected Routes

### Signed-Out User Is Redirected To Login

1. Start signed out in a clean browser profile.
2. Open `https://{DOMAIN_NAME}/dashboard`.
3. Open `https://{DOMAIN_NAME}/admin/people`.
4. Open `https://{DOMAIN_NAME}/settings`.

Expected result:

- Each protected page redirects to `/login`.
- The `callbackURL` points back to the originally requested page.

### Active Member Can Open Dashboard

1. Sign in as `{CONTRACTOR_EMAIL}` or `{EMPLOYEE_EMAIL}` after that account has either a passkey
   or TOTP enabled.
2. Open `https://{DOMAIN_NAME}/dashboard`.

Expected result:

- The dashboard opens in the app shell.
- The user menu shows the signed-in member.
- The sidebar and header are visible.

### Non-Admin Member Cannot Open People Admin

1. Sign in as `{CONTRACTOR_EMAIL}` or `{EMPLOYEE_EMAIL}` after that account has either a passkey
   or TOTP enabled.
2. Open `https://{DOMAIN_NAME}/admin/people`.

Expected result:

- The app shows an `Admin access required` account status page.
- The people table is not visible.

## Admin People

### Admin Can Open People Page

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/people`.

Expected result:

- The people page opens.
- The invite form is visible.
- Currency, timezone, and locale are dropdowns.
- The member directory table is visible.
- The app shell user menu shows the admin user.

### Invite Member

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/people`.
3. Fill the invite form:
   - First name: `{INVITED_FIRST_NAME}`
   - Last name: `{INVITED_LAST_NAME}`
   - Email: `{INVITED_EMAIL}`
   - Profile: `{INVITED_PROFILE}`
   - Role: `{INVITED_ROLE}`
   - Currency: `{INVITED_CURRENCY}`
   - Timezone: `{INVITED_TIMEZONE}`
   - Locale: `{INVITED_LOCALE}`
4. Click `Send invitation`.

Expected result:

- A success message confirms that an invitation was sent.
- The invited person appears in the member directory with state `invited`.
- The invited person receives an invitation email.

### Resend Invitation

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/people`.
3. Find a member with state `invited`.
4. Click the resend invitation action.

Expected result:

- A success message confirms the invitation was resent.
- The invited email receives a new invitation link.

### Edit Member Details

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/people`.
3. Find an invited, active, or inactive member.
4. Click the edit action.
5. Change first name, last name, display name, currency, timezone, and locale.
6. Click `Save changes`.
7. Refresh `https://{DOMAIN_NAME}/admin/people`.

Expected result:

- The edit drawer opens with the member's current domain profile values.
- Currency, timezone, and locale are dropdowns.
- The updated member name and currency are visible after saving and after refresh.
- Empty required fields show validation errors.
- The member's Better Auth email/account is not changed by this flow.
- An audit row is recorded for `member.updated` with before and after values.

### Schedule Profile Transition

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/people`.
3. Find an invited, active, or inactive member.
4. Click the edit action.
5. In `Profile transition`, choose the opposite profile.
6. Choose `{PROFILE_TRANSITION_VALID_FROM}` as today or a future date.
7. Enter `{PROFILE_TRANSITION_REASON}`.
8. Click `Schedule transition`.
9. Refresh `https://{DOMAIN_NAME}/admin/people`.

Expected result:

- A success message confirms either immediate profile change or scheduled transition.
- If the effective date is today, the member's current profile changes after refresh.
- If the effective date is in the future, the people table shows the scheduled profile and date.
- Past effective dates show validation errors and do not create profile history.
- A second future transition for the same member is rejected until the existing one is handled.
- An audit row is recorded for `member.profile_changed` or
  `member.profile_transition_scheduled`.

### Deactivate And Reactivate Member

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/people`.
3. Find an active non-admin test member.
4. Click the deactivate action.
5. Confirm the member state changes to inactive.
6. Click the reactivate action.

Expected result:

- Deactivation blocks that member from protected app access.
- Deactivation revokes that member's active sessions.
- Reactivation restores access.
- The member directory reflects the latest state.
- Audit rows are recorded for `member.deactivated`, `member.session_revoked`, and
  `member.reactivated`.

### Archive Member

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/people`.
3. Find an active, inactive, or invited non-admin test member.
4. Click `Archive`.
5. Confirm the archive dialog.
6. Refresh `https://{DOMAIN_NAME}/admin/people`.

Expected result:

- A success message confirms that the member was archived.
- The member directory shows the archived member as locked.
- Active sessions for that member are revoked.
- Pending invitations for that member are revoked.
- The archived member cannot open protected app pages.
- Historical time entries, timesheets, invoices, payslips, reports, and audit records remain.
- An audit row is recorded for `member.deleted`.
- For linked auth users, an audit row is recorded for `member.session_revoked`.
- For pending invitations, an audit row is recorded for `member.pending_invitations_revoked`.

### Archive Safety Guards

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/people`.
3. Confirm the current admin row does not offer `Archive`.
4. Try to archive the last active admin using a test setup with no other active admins.

Expected result:

- Admins cannot archive their own account from the people table.
- The server rejects archiving the last active admin.
- The member remains active when the last-admin guard rejects the action.

### Revoke Member Sessions

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified in one browser profile.
2. Sign in as `{CONTRACTOR_EMAIL}` or `{EMPLOYEE_EMAIL}` in a second browser profile.
3. In the admin browser, open `https://{DOMAIN_NAME}/admin/people`.
4. Find the signed-in contractor or employee.
5. Click `Revoke sessions`.
6. In the contractor or employee browser, refresh `https://{DOMAIN_NAME}/dashboard`.

Expected result:

- The admin browser shows how many sessions were revoked.
- The contractor or employee is forced back through sign-in before accessing protected pages again.
- The admin cannot revoke their own sessions from this table.
- An audit row is recorded for `member.session_revoked` with reason `admin_revoke`.

## Security Settings

### Security Setup Gate

1. Sign in as an active member that has no passkey and no TOTP.
2. Open `https://{DOMAIN_NAME}/dashboard`.
3. Open `https://{DOMAIN_NAME}/settings`.

Expected result:

- `/dashboard` redirects to `/settings?setup=required...`.
- The settings page shows an action-required security setup banner.
- The user can still access the passkey and authenticator-app controls.
- After adding a passkey or enabling TOTP, `/dashboard` opens.

### Admin TOTP Gate

1. Sign in as an admin that has a passkey but does not have TOTP enabled.
2. Open `https://{DOMAIN_NAME}/admin/people`.
3. Open `https://{DOMAIN_NAME}/settings`.

Expected result:

- `/admin/people` redirects to `/settings?setup=required&...reason=admin-totp-required...`.
- The settings page explains that admin tools require authenticator-app 2FA.
- After enabling and verifying TOTP, `/admin/people` opens.

### Open Security Settings

1. Sign in as `{ADMIN_EMAIL}` or `{CONTRACTOR_EMAIL}`.
2. Open `https://{DOMAIN_NAME}/settings`.

Expected result:

- The security settings page opens.
- Magic link is shown as connected.
- Email password is shown as enabled or available.
- Company Google is shown when Google auth is configured.
- Passkey and authenticator-app sections are visible.

## Passkeys

### Add Device Passkey

1. Sign in as `{ADMIN_EMAIL}` or `{CONTRACTOR_EMAIL}` on `{PASSKEY_DEVICE}`.
2. Open `https://{DOMAIN_NAME}/settings`.
3. Enter a recognizable passkey name.
4. Click `Add device passkey`.
5. Complete the browser or operating-system passkey prompt.

Expected result:

- The passkey is added.
- The passkey appears in the registered passkeys list.
- The passkey can be renamed or removed.
- An audit row is recorded for `security.passkey_added` without passkey public key material.

### Passkey Login

1. Sign out.
2. Open `https://{DOMAIN_NAME}/login`.
3. Click `Continue with passkey`.
4. Complete the passkey prompt on `{PASSKEY_DEVICE}`.

Expected result:

- The user lands on `/dashboard`, unless 2FA is enabled.
- If 2FA is enabled, the user lands on `/two-factor`.

### Remove Passkey

1. Sign in as the user who owns the passkey.
2. Open `https://{DOMAIN_NAME}/settings`.
3. Find the registered passkey.
4. Click `Remove`.
5. Confirm removal.

Expected result:

- The passkey disappears from the list.
- The removed passkey cannot be used for login anymore.
- Magic-link login remains available.
- An audit row is recorded for `security.passkey_deleted` without passkey public key material.

### Rename Passkey

1. Sign in as the user who owns a registered passkey.
2. Open `https://{DOMAIN_NAME}/settings`.
3. Find the registered passkey.
4. Change the passkey name.
5. Click `Save`.
6. Refresh the settings page.

Expected result:

- The updated passkey name remains visible after refresh.
- An audit row is recorded for `security.passkey_renamed`.

## TOTP 2FA

### Enable Authenticator App

1. Sign in as `{ADMIN_EMAIL}` or `{CONTRACTOR_EMAIL}`.
2. Open `https://{DOMAIN_NAME}/settings`.
3. Click `Set up authenticator`.
4. Scan the displayed QR code with `{AUTHENTICATOR_APP}`.
5. Enter the current 6-digit code.
6. Click `Verify and enable`.

Expected result:

- Authenticator app becomes enabled.
- Backup codes are shown.
- The user remains signed in.
- Store backup codes for later backup-code tests.
- An audit row is recorded for `security.totp_enabled` without the TOTP secret or backup codes.

Fallback check:

- If QR scanning is unavailable, copy the manual key fallback into `{AUTHENTICATOR_APP}` and verify
  that setup still works.

### 2FA Challenge After Magic-Link Login

1. Make sure TOTP is enabled for `{ADMIN_EMAIL}` or `{CONTRACTOR_EMAIL}`.
2. Sign out.
3. Open `https://{DOMAIN_NAME}/login`.
4. Sign in using magic link.

Expected result:

- After the magic-link email is opened, the app redirects to `/two-factor`.
- The magic-link sign-in does not satisfy the 2FA challenge by itself.
- `/dashboard` is not accessible until the TOTP code is verified.

### Verify TOTP Challenge

1. On `/two-factor`, keep the `Authenticator` tab selected.
2. Enter the current 6 digit code from `{AUTHENTICATOR_APP}`.
3. Click `Verify`.

Expected result:

- The challenge succeeds.
- The user is redirected to the original `callbackURL`, normally `/dashboard`.

### Invalid TOTP Code

1. Trigger `/two-factor`.
2. Enter an incorrect 6 digit code.
3. Click `Verify`.

Expected result:

- The page shows an error.
- The user remains on `/two-factor`.
- Protected pages remain blocked.

### Trust This Device

1. Trigger `/two-factor`.
2. Check `Trust this device`.
3. Enter a valid TOTP code.
4. Click `Verify`.
5. Sign out.
6. Sign in again in the same browser profile.

Expected result:

- The first challenge succeeds.
- The next sign-in in the same browser skips `/two-factor` while the trust period is valid.

### Backup Code Challenge

1. Make sure backup codes were generated and stored during TOTP setup.
2. Sign out.
3. Sign in again until `/two-factor` is shown.
4. Open the `Backup code` tab.
5. Enter one unused backup code.
6. Click `Verify`.

Expected result:

- The backup code signs the user in.
- The used backup code cannot be reused.

### Disable Authenticator App

1. Sign in as the user who has TOTP enabled.
2. Open `https://{DOMAIN_NAME}/settings`.
3. Click `Disable` in the authenticator-app section.
4. Confirm the browser prompt.
5. Sign out and sign in again.

Expected result:

- Authenticator app is disabled.
- Future sign-ins no longer require `/two-factor` only if another security method, such as a
  passkey, remains available.
- If no passkey remains, protected pages redirect to `/settings?setup=required...`.
- Admin users cannot use admin pages again until TOTP is re-enabled.
- An audit row is recorded for `security.totp_disabled`.

### Regenerate Backup Codes

1. Sign in as the user who has TOTP enabled.
2. Open `https://{DOMAIN_NAME}/settings`.
3. Click `New backup codes`.
4. Confirm the browser prompt.
5. Store one of the newly displayed backup codes.
6. Sign out and sign in until `/two-factor` is shown.
7. Open the `Backup code` tab.
8. Enter the stored new backup code.
9. Try one of the older backup codes from before regeneration.

Expected result:

- New backup codes are displayed after regeneration.
- A new backup code can complete the 2FA challenge once.
- Older backup codes no longer work.
- An audit row is recorded for `security.backup_codes_regenerated` without any backup-code values.

## Account Status And Lifecycle

### Inactive Member Is Blocked

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Deactivate `{CONTRACTOR_EMAIL}` from `/admin/people`.
3. Sign out.
4. Sign in as `{CONTRACTOR_EMAIL}`.
5. Open `https://{DOMAIN_NAME}/dashboard`.

Expected result:

- The inactive member sees an account status page.
- Dashboard content is not visible.

### Invited But Not Activated Member Is Blocked

1. Use an invited member that has not completed activation.
2. Sign in through the invitation email if possible.
3. Open `https://{DOMAIN_NAME}/dashboard`.

Expected result:

- The member is told to activate the invitation first.
- Dashboard content is not visible until activation succeeds.

### Archived Member Is Blocked

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Archive `{CONTRACTOR_EMAIL}` from `/admin/people`.
3. Sign out.
4. Sign in as `{CONTRACTOR_EMAIL}` if authentication is still possible.
5. Open `https://{DOMAIN_NAME}/dashboard`.

Expected result:

- The archived member sees an account status page.
- Dashboard content is not visible.
- Reusing an old invitation link for that member does not reactivate the archived account.

## Navigation

### Sidebar Real Routes

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/dashboard`.
3. Click `Irányítópult` in the sidebar.
4. Click `Emberek` in the sidebar.

Expected result:

- `Irányítópult` opens `/dashboard`.
- `Emberek` opens `/admin/people`.
- The current sidebar item is highlighted.

## Regression Checklist For Every Release

- Invitation activation works for a new invited user.
- Magic-link login works for an active user.
- Unknown email login does not reveal account state.
- Signed-out users cannot open protected routes.
- Non-admin users cannot open admin routes.
- Users without passkey or TOTP are redirected to the security setup gate.
- Admin users without TOTP are redirected to the admin TOTP gate.
- Admin people page can invite, resend, edit, deactivate, reactivate, and archive members.
- Admin people page can revoke member sessions.
- Passkey add, login, rename, and remove still work.
- TOTP setup, challenge, invalid-code handling, trusted device, backup-code fallback, and disable
  still work.
- TOTP disablement and backup-code regeneration create audit rows without storing secrets.
- `/dashboard`, `/settings`, `/admin/people`, `/two-factor`, and `/account-status` render without
  layout breakage on desktop and mobile widths.
