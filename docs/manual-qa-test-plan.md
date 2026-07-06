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

## Smoke: Deployment Is Reachable

### Steps

1. Open `https://{DOMAIN_NAME}`.
2. Wait for the page to finish loading.

### Expected Result

- The app redirects unauthenticated users to `https://{DOMAIN_NAME}/login?callbackURL=%2Fdashboard`.
- No blank page or server error is shown.

## Invitation Activation

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
- The user is sent to `https://{DOMAIN_NAME}/dashboard`.
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

- The user lands on `https://{DOMAIN_NAME}/dashboard`, unless 2FA is enabled.
- If 2FA is enabled, the user lands on `https://{DOMAIN_NAME}/two-factor?...`.

### Unknown Email Does Not Reveal Account State

1. Start signed out.
2. Open `https://{DOMAIN_NAME}/login`.
3. Enter `{UNKNOWN_EMAIL}`.
4. Click `Email sign-in link`.

Expected result:

- The UI shows a neutral success-style message.
- No account existence information is revealed in the browser.
- No app session is created for `{UNKNOWN_EMAIL}`.

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

1. Sign in as `{CONTRACTOR_EMAIL}` or `{EMPLOYEE_EMAIL}`.
2. Open `https://{DOMAIN_NAME}/dashboard`.

Expected result:

- The dashboard opens in the app shell.
- The user menu shows the signed-in member.
- The sidebar and header are visible.

### Non-Admin Member Cannot Open People Admin

1. Sign in as `{CONTRACTOR_EMAIL}` or `{EMPLOYEE_EMAIL}`.
2. Open `https://{DOMAIN_NAME}/admin/people`.

Expected result:

- The app shows an `Admin access required` account status page.
- The people table is not visible.

## Admin People

### Admin Can Open People Page

1. Sign in as `{ADMIN_EMAIL}`.
2. Open `https://{DOMAIN_NAME}/admin/people`.

Expected result:

- The people page opens.
- The invite form is visible.
- The member directory table is visible.
- The app shell user menu shows the admin user.

### Invite Member

1. Sign in as `{ADMIN_EMAIL}`.
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

1. Sign in as `{ADMIN_EMAIL}`.
2. Open `https://{DOMAIN_NAME}/admin/people`.
3. Find a member with state `invited`.
4. Click the resend invitation action.

Expected result:

- A success message confirms the invitation was resent.
- The invited email receives a new invitation link.

### Deactivate And Reactivate Member

1. Sign in as `{ADMIN_EMAIL}`.
2. Open `https://{DOMAIN_NAME}/admin/people`.
3. Find an active non-admin test member.
4. Click the deactivate action.
5. Confirm the member state changes to inactive.
6. Click the reactivate action.

Expected result:

- Deactivation blocks that member from protected app access.
- Reactivation restores access.
- The member directory reflects the latest state.

## Security Settings

### Open Security Settings

1. Sign in as `{ADMIN_EMAIL}` or `{CONTRACTOR_EMAIL}`.
2. Open `https://{DOMAIN_NAME}/settings`.

Expected result:

- The security settings page opens.
- Magic link is shown as connected.
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
- Future sign-ins no longer require `/two-factor`.

## Account Status And Lifecycle

### Inactive Member Is Blocked

1. Sign in as `{ADMIN_EMAIL}`.
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

## Navigation

### Sidebar Real Routes

1. Sign in as `{ADMIN_EMAIL}`.
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
- Admin people page can invite, resend, deactivate, and reactivate members.
- Passkey add, login, rename, and remove still work.
- TOTP setup, challenge, invalid-code handling, trusted device, backup code, and disable still work.
- `/dashboard`, `/settings`, `/admin/people`, `/two-factor`, and `/account-status` render without
  layout breakage on desktop and mobile widths.
