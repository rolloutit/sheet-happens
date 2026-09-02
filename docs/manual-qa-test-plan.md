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
- `{SYSTEM_CHECK_VIEW}`: admin system-check path, default `https://{DOMAIN_NAME}/admin/system`.
- `{AUDIT_LOG_VIEW}`: audit-log viewer path, default `https://{DOMAIN_NAME}/admin/audit`.
- `{HELP_VIEW}`: Help page path, default `https://{DOMAIN_NAME}/help`.
- `{ADMIN_INFO_VIEW}`: admin information-page editor path, default `https://{DOMAIN_NAME}/admin/info`.
- `{INVITED_EMAIL}`: email address that owns the tested invitation.
- `{INVITED_FIRST_NAME}`: first name used when creating a new invited member.
- `{INVITED_LAST_NAME}`: last name used when creating a new invited member.
- `{INVITED_PROFILE}`: profile selected for a new invited member, for example contractor or employee.
- `{INVITED_ROLE}`: role selected for a new invited member, for example member or admin.
- `{INVITED_CURRENCY}`: default currency selected for a new invited member.
- `{INVITED_TIMEZONE}`: timezone selected for a new invited member.
- `{INVITED_LOCALE}`: locale selected for a new invited member.
- `{UNKNOWN_EMAIL}`: email address that is not a Sheet Happens member or pending invite.
- `{LOCKOUT_TEST_EMAIL}`: active test account with a known password, reserved for sign-in lockout testing.
- `{COMPANY_GOOGLE_DOMAIN}`: allowed Google Workspace domain configured for company Google login.
- `{COMPANY_GOOGLE_EMAIL}`: activated member email in `{COMPANY_GOOGLE_DOMAIN}`.
- `{PRIVATE_GOOGLE_EMAIL}`: Google email outside `{COMPANY_GOOGLE_DOMAIN}`.
- `{PROFILE_TRANSITION_VALID_FROM}`: today or a future date for profile transition testing.
- `{PROFILE_TRANSITION_REASON}`: reason text for profile transition testing.
- `{AUTHENTICATOR_APP}`: authenticator app used for TOTP testing.
- `{PASSKEY_DEVICE}`: passkey-capable test device or browser profile.
- `{TIME_TRACKING_WEEK_START}`: Monday date of a test week, formatted as `YYYY-MM-DD`.
- `{TIME_TRACKING_PREVIOUS_WEEK_START}`: Monday date one week before `{TIME_TRACKING_WEEK_START}`.
- `{TIME_TRACKING_PROJECT_A}`: active project assigned to the time-tracking test user.
- `{TIME_TRACKING_PROJECT_B}`: second active project assigned to the time-tracking test user.
- `{TIME_ENTRY_DESCRIPTION}`: description text used for test time entries.
- `{TIME_ENTRY_UPDATED_DESCRIPTION}`: edited description text used for test time entries.
- `{TIMESHEET_MONTH}`: contractor timesheet month formatted as `YYYY-MM`.
- `{TIMESHEET_PROJECT_A}`: first contractor project used in timesheet tests.
- `{TIMESHEET_PROJECT_B}`: second contractor project used in timesheet tests.
- `{TIMESHEET_CURRENCY_A}`: first currency used in mixed-currency timesheet tests.
- `{TIMESHEET_CURRENCY_B}`: second currency used in mixed-currency timesheet tests.
- `{TIMESHEET_REJECTION_REASON}`: reason text used when rejecting a submitted timesheet.
- `{INVOICE_NUMBER}`: invoice number used for contractor invoice upload testing.
- `{INVOICE_AMOUNT}`: declared invoice amount used for contractor invoice upload testing.
- `{INVOICE_PDF_FILE}`: local PDF file used for contractor invoice upload testing.
- `{INVOICE_REJECTION_REASON}`: reason text used when rejecting an uploaded invoice.
- `{CANCELLATION_INVOICE_NUMBER}`: invoice number used for the cancellation invoice.
- `{CANCELLATION_INVOICE_PDF_FILE}`: local PDF file used for cancellation invoice testing.
- `{CORRECTED_INVOICE_NUMBER}`: invoice number used for the corrected replacement invoice.
- `{CORRECTED_INVOICE_PDF_FILE}`: local PDF file used for corrected invoice testing.
- `{PROJECT_NAME}`: name for a newly created project.
- `{PROJECT_UPDATED_NAME}`: updated project name.
- `{PROJECT_SLUG}`: URL-safe or code-like project slug.
- `{PROJECT_UPDATED_SLUG}`: updated project slug.
- `{PROJECT_GROUP_NAME}`: name for a project group.
- `{PROJECT_GROUP_UPDATED_NAME}`: updated project group name.
- `{PROJECT_ASSIGNMENT_START}`: assignment start date formatted as `YYYY-MM-DD`.
- `{PROJECT_ASSIGNMENT_END}`: assignment end date formatted as `YYYY-MM-DD`.
- `{PROJECT_ASSIGNMENT_NOTE}`: note text for project assignment testing.
- `{BULK_ASSIGNMENT_START}`: bulk assignment start date formatted as `YYYY-MM-DD`.
- `{RATE_VALID_FROM}`: rate start date formatted as `YYYY-MM-DD`.
- `{RATE_FUTURE_MONTH_START}`: first day of a future month, formatted as `YYYY-MM-DD`.
- `{RATE_AMOUNT}`: hourly rate amount, for example `16000`.
- `{RATE_UPDATED_AMOUNT}`: second hourly rate amount, for example `18000`.
- `{RATE_CURRENCY}`: initial rate currency, for example `HUF`.
- `{RATE_UPDATED_CURRENCY}`: second rate currency, for example `EUR`.
- `{RATE_NOTE}`: reason or note text for rate testing.
- `{REPORT_EXPORT_TITLE}`: title used for a cost-free report PDF export.
- `{INTERNAL_REPORT_EXPORT_TITLE}`: title used for an internal report PDF export.
- `{HELP_WELCOME_TITLE}`: title used when testing admin-edited Help welcome content.
- `{HELP_WELCOME_MARKDOWN}`: markdown body used when testing admin-edited Help welcome content.
- `{PAYSLIP_MONTH}`: employee payslip month formatted as `YYYY-MM`.
- `{PAYSLIP_PDF_FILE}`: valid PDF file, no larger than 10 MB, used for payslip upload.
- `{PAYSLIP_REPLACEMENT_PDF_FILE}`: different valid PDF file used to replace a payslip.
- `{NON_PDF_FILE}`: non-PDF file used to test payslip file validation.

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

## Smoke: Admin System Check Passes

Run this after deployment configuration changes and before invoice testing.

### Steps

1. Sign in as `{ADMIN_EMAIL}`.
2. Open `{SYSTEM_CHECK_VIEW}`.
3. Confirm the page shows application configuration, database, object storage, email delivery, Google OAuth, and Typst PDF renderer checks.
4. Confirm the object storage check completes a temporary write, read, and delete probe.
5. Confirm the Typst PDF renderer check completes a temporary PDF render probe.
6. Open `https://{DOMAIN_NAME}/api/admin/system-check` in a new tab.

### Expected Result

- Application configuration, database, object storage, and Typst PDF renderer are passing before invoice upload and report PDF export tests.
- Email delivery is passing when SMTP is expected, or shows a clear warning when console mode is intentionally used.
- Google OAuth is passing when Google sign-in is expected, or shows a clear warning when it is intentionally disabled.
- The JSON endpoint returns the same check results without exposing secret values.
- Non-admin users cannot open the system check page or endpoint.

## Invitation Activation

Invitation acceptance links are valid for 72 hours. Resending an invitation should rotate the link
and start a fresh 72-hour window.

### Bootstrap Admin Invitation Opens Correctly

Run this test only on a fresh QA environment that was deployed with bootstrap admin enabled.

1. Open the bootstrap admin accept URL provided by the deployment owner.
2. Confirm the page shows `{ADMIN_EMAIL}`.
3. Confirm the primary action offers to send an email sign-in link.

Expected result:

- The bootstrap admin invitation page loads.
- The invited email matches `{ADMIN_EMAIL}`.
- The page does not activate the account until the admin signs in with `{ADMIN_EMAIL}`.
- The bootstrap invitation expires after 72 hours.

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

- If 2FA is enabled and the browser is not trusted, the user lands on
  `https://{DOMAIN_NAME}/two-factor?...`.
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
5. Click `Sign in`.

Expected result:

- If 2FA is enabled and the browser is not trusted, the user lands on
  `https://{DOMAIN_NAME}/two-factor?...`.
- Otherwise, the user lands on `https://{DOMAIN_NAME}/dashboard`.
- Public sign-up is not available from the login screen.

### Password Sign-In Lockout And Recovery

1. Start signed out in a clean browser profile.
2. Open `https://{DOMAIN_NAME}/login`.
3. Enter `{LOCKOUT_TEST_EMAIL}` and a deliberately incorrect password.
4. Submit the password form five times within 15 minutes.
5. Confirm the fifth response says that there have been too many password sign-in attempts.
6. Enter the correct password before the 15-minute lock expires and submit it.
7. Wait until 15 minutes have elapsed from the fifth failed attempt.
8. Enter the correct password again and complete any required second factor.
9. Open `{AUDIT_LOG_VIEW}` and search for the tested member.

Expected result:

- The first four failed attempts show the same neutral invalid-credentials message.
- The fifth failed attempt and every password attempt during the temporary lock show a rate-limit message.
- A correct password does not bypass the active temporary lock.
- The lock expires automatically after 15 minutes; no administrator action is required.
- The account can sign in normally after expiry.
- The audit log contains `security.password_lockout` and, after the successful recovery sign-in,
  `security.password_lockout_recovered`.

### Authentication Endpoint Rate Limits

1. Start signed out in a clean browser profile.
2. Open `https://{DOMAIN_NAME}/login`.
3. Enter `{UNKNOWN_EMAIL}` and click `Email sign-in link` six times within 15 minutes.
4. Confirm the sixth request is refused with a rate-limit message.
5. Wait 15 minutes, then repeat the request once.

Expected result:

- The first five requests retain the neutral response and do not reveal whether the email exists.
- The sixth request shows a localized rate-limit message.
- The request is accepted again after the 15-minute rate-limit window.

### Password Reset For Unknown Email Is Neutral

1. Start signed out.
2. Open `https://{DOMAIN_NAME}/login`.
3. Enter `{UNKNOWN_EMAIL}`.
4. Click `Forgot password?`.

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
- The user is then routed through the normal app gates: `/two-factor` when TOTP is enabled and the
  browser is not trusted, `/settings`, or `/dashboard`.

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

### Inactive Member Cannot Create A New Session

1. Sign in as `{ADMIN_EMAIL}` and deactivate an active, non-admin test member from the People page.
2. Confirm that the member's existing browser session no longer opens protected pages.
3. In a clean browser profile, attempt password sign-in for the inactive member using a correct password.
4. Request a magic-link sign-in for the inactive member and confirm no email arrives.
5. If the inactive member has a passkey, attempt passkey sign-in.
6. If company Google sign-in is configured for the member, complete the Google provider flow.

Expected result:

- Deactivation revokes existing sessions.
- Password, passkey, and Google authentication do not create an application session for an inactive member.
- Magic-link requests stay neutral and do not deliver a usable sign-in link.
- The inactive member cannot open `/dashboard`, `/time`, `/timesheets`, `/settings`, or any admin route.

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

## Time Tracking

Run these tests as `{CONTRACTOR_EMAIL}` or `{EMPLOYEE_EMAIL}`. The user must be active and assigned
to `{TIME_TRACKING_PROJECT_A}` and `{TIME_TRACKING_PROJECT_B}` for `{TIME_TRACKING_WEEK_START}`.

### Weekly Grid Loads Assigned Projects

1. Open `https://{DOMAIN_NAME}/time?week={TIME_TRACKING_WEEK_START}`.
2. Confirm the weekly grid is visible.
3. Confirm `{TIME_TRACKING_PROJECT_A}` and `{TIME_TRACKING_PROJECT_B}` are listed.
4. Use the previous-week and next-week controls.
5. Return to `{TIME_TRACKING_WEEK_START}`.

Expected result:

- Only active assigned projects are listed.
- Week navigation keeps the user on `/time`.
- The week total and daily totals are visible.

### Create, Edit, And Delete Duration Entry

1. Open `https://{DOMAIN_NAME}/time?week={TIME_TRACKING_WEEK_START}`.
2. Click an empty cell for `{TIME_TRACKING_PROJECT_A}` on a non-future day.
3. Enter `{TIME_ENTRY_DESCRIPTION}`.
4. Enter duration `3h 20m`.
5. Save.
6. Open the same cell's entry details.
7. Edit the entry description to `{TIME_ENTRY_UPDATED_DESCRIPTION}` and duration to `200m`.
8. Save.
9. Open the entry details again and delete the entry.

Expected result:

- The empty cell opens the entry form because descriptions are required.
- `3h 20m` and `200m` are accepted as equivalent duration formats.
- The cell, day total, and week total update after create, edit, and delete.
- Deleted entries disappear from the grid.

### Create Interval Entry And Check Warnings

1. Open `https://{DOMAIN_NAME}/time?week={TIME_TRACKING_WEEK_START}`.
2. Click `New entry`.
3. Choose `{TIME_TRACKING_PROJECT_A}`.
4. Choose a date in the selected week.
5. Switch the mode to `Interval`.
6. Enter start `09:00`, end `10:30`, and `{TIME_ENTRY_DESCRIPTION}`.
7. Save.
8. Create another interval on the same day that overlaps the first interval.
9. Create or edit entries so the day total exceeds 8 hours.
10. Try to create or edit entries so the day total exceeds 24 hours.

Expected result:

- Interval entries save with the correct calculated duration.
- Overlaps show a warning but do not block saving.
- More than 8 hours in one day shows a warning but does not block saving.
- More than 24 hours in one day is blocked.

### Timer Start And Stop

1. Open `https://{DOMAIN_NAME}/time?week={TIME_TRACKING_WEEK_START}` and stay in `Grid` view.
2. Click `New timer`.
3. Enter `{TIME_ENTRY_DESCRIPTION}` in the description field.
4. Choose `{TIME_TRACKING_PROJECT_A}`.
5. Click `Start`.
6. Confirm the running timer appears on the page and in the app header, in `Grid` view as well as
   in `Day` view.
7. Confirm `New timer` is now disabled, and that hovering it explains that the running timer has to
   be stopped first.
8. Stop the timer from the card on the page.

Expected result:

- Only one timer can run for the user.
- The elapsed timer label changes while running without hydration errors.
- Stopping the timer creates a time entry on the timer start date.
- Reopening `https://{DOMAIN_NAME}/time?new=timer` directly opens the dialog with empty fields.
- Cancelling the dialog, or pressing `Escape`, leaves no timer running and no entry behind.

### Running Timer Is Visible And Stoppable From Every Page

1. Open `https://{DOMAIN_NAME}/time` and start a timer for `{TIME_TRACKING_PROJECT_A}`.
2. Navigate to `Dashboard`, then `Timesheets`, then an admin page such as `Projects`.
3. Confirm on each page that the header shows the running timer and that the elapsed reading keeps
   counting up rather than restarting at `0:00`.
4. Narrow the window to a mobile width and confirm the timer is still in the header — the elapsed
   time and the stop button remain, the project name gives way.
5. Stop the timer from the header while on the admin page.
6. Confirm the timer disappears from the header immediately, without a page reload.
7. Open `https://{DOMAIN_NAME}/time` and confirm the entry was saved on the day the timer started.

Expected result:

- The timer follows the user across every signed-in page and both breakpoints.
- Moving between pages neither hides the timer nor resets its elapsed reading.
- Stopping from any page clears the timer everywhere and writes the time entry.
- A page reload on any route still shows the running timer.

### Timer Discarded At The Daily Limit Says So

1. Log entries totalling close to 24 hours on one day for the test user.
2. Start a timer that would push that day past 24 hours, and let it run.
3. Navigate away from `Time`, then stop the timer from the app header.

Expected result:

- The timer disappears from the header rather than lingering as a phantom.
- The reason the time was discarded is shown next to where the timer was, and stays on screen until
  it is dismissed.
- No time entry is created for that day.

### Same As Yesterday Does Not Duplicate Existing Cells

1. Open `https://{DOMAIN_NAME}/time?week={TIME_TRACKING_WEEK_START}`.
2. Create one entry for `{TIME_TRACKING_PROJECT_A}` on a test day.
3. Select the next day.
4. Click `Same as yesterday`.
5. Cancel the confirmation dialog.
6. Confirm no copied entry appears on the selected day.
7. Click `Same as yesterday` again.
8. Confirm the dialog.
9. Confirm the copied entry appears on the selected day.
10. Click `Same as yesterday` again for the same selected day and confirm the dialog.

Expected result:

- The quick action does not run until the confirmation dialog is confirmed.
- The first copy creates entries from the previous day.
- The second copy does not create duplicate entries in project/date cells that already contain time.
- The success message reports skipped entries when applicable.

### Duplicate Last Week Does Not Duplicate Existing Cells

1. Open `https://{DOMAIN_NAME}/time?week={TIME_TRACKING_PREVIOUS_WEEK_START}`.
2. Create entries for `{TIME_TRACKING_PROJECT_A}` and `{TIME_TRACKING_PROJECT_B}`.
3. Open `https://{DOMAIN_NAME}/time?week={TIME_TRACKING_WEEK_START}`.
4. Click `Duplicate last week`.
5. Cancel the confirmation dialog.
6. Confirm no previous-week entries appear in the current week.
7. Click `Duplicate last week` again.
8. Confirm the dialog.
9. Confirm the previous week's entries appear in the matching days of the current week.
10. Click `Duplicate last week` again and confirm the dialog.

Expected result:

- The quick action does not run until the confirmation dialog is confirmed.
- Entries are copied from the previous week into matching current-week days.
- Repeating the action skips project/date cells that already contain entries.
- Existing current-week entries are not overwritten.

### Draft Restore And Discard

1. Open `https://{DOMAIN_NAME}/time?week={TIME_TRACKING_WEEK_START}`.
2. Click `New entry`.
3. Choose `{TIME_TRACKING_PROJECT_A}`.
4. Enter `{TIME_ENTRY_DESCRIPTION}` but do not save.
5. Wait until the form shows that the draft is saved.
6. Close the dialog.
7. Refresh the page.
8. Click `Restore draft`.
9. Confirm the form restores the project, date, duration mode, duration or interval values, and
   description.
10. Close the dialog again and click `Discard`.
11. Refresh the page.

Expected result:

- Drafts are restored after refresh.
- Discard removes the draft banner.
- Drafts never change the grid totals until saved as a real entry.

### Inactive Project Week

1. Open `https://{DOMAIN_NAME}/time?week={TIME_TRACKING_WEEK_START}`.
2. Choose an assigned project row with no entries in the week.
3. Mark the project as inactive for the week.
4. Undo the inactive mark.
5. Create an entry for the same project.
6. Try to mark the project inactive again.

Expected result:

- Empty project weeks can be marked inactive and restored.
- Project weeks with entries cannot be marked inactive until entries are removed.
- Inactive rows do not contribute missing-work signals.

### Time Entry Dialog Keyboard Behavior

1. Open a new time entry dialog.
2. Use `Tab` repeatedly.
3. Use `Shift+Tab` repeatedly.
4. Press `Escape`.
5. Open an existing entry details dialog and repeat the same keyboard checks.

Expected result:

- Keyboard focus stays inside the open dialog.
- `Escape` closes the dialog.
- Focus returns to the control that opened the dialog.

## Contractor Timesheets

Run these tests as `{CONTRACTOR_EMAIL}` unless the scenario says otherwise.

### Contractor Can Open Monthly Preview

1. Open `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
2. Confirm the Timesheets page opens in the app shell.
3. Confirm the current and previous month controls are visible.
4. Confirm the selected month shows a status.
5. Confirm the summary shows hours, amount, and entry count.
6. Confirm the project breakdown is grouped by project.

Expected result:

- Contractors can access `/timesheets`.
- The preview is calculated from current time entries when no submitted snapshot exists.
- Projects show total hours, rate state, currency, and amount.
- Hours in the summary and the project breakdown render decimal at two fraction digits (e.g.
  `9.50 h`) next to the amount, regardless of the `Time display` preference set in Settings.
- Missing rates or mixed currencies are shown as warnings instead of hidden.

### Contractor Workflow Stepper Follows The Monthly Status

Use a month that can be taken through the complete workflow. Check both
`https://{DOMAIN_NAME}/dashboard` and
`https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}` after every status change.

1. Before submitting the month, open both pages as `{CONTRACTOR_EMAIL}`.
2. Confirm the status is `Not created` and the first workflow node is current.
3. Hover over each locked node and then reach each locked node using only the keyboard.
4. Submit the month and reopen both pages.
5. As `{ADMIN_EMAIL}`, reject the submitted timesheet using `{TIMESHEET_REJECTION_REASON}`.
6. Reopen both contractor pages as `{CONTRACTOR_EMAIL}`.
7. Correct the time entries, resubmit the month, and approve it as `{ADMIN_EMAIL}`.
8. Reopen both contractor pages and upload `{INVOICE_PDF_FILE}` with `{INVOICE_NUMBER}` and
   `{INVOICE_AMOUNT}`.
9. As `{ADMIN_EMAIL}`, reject the invoice using `{INVOICE_REJECTION_REASON}`.
10. Reopen both contractor pages.
11. Upload `{CANCELLATION_INVOICE_PDF_FILE}` and then `{CORRECTED_INVOICE_PDF_FILE}` through the
    correction flow.
12. As `{ADMIN_EMAIL}`, accept the corrected invoice.
13. Reopen both contractor pages and then mark the invoice as paid as `{ADMIN_EMAIL}`.
14. Reopen both contractor pages one final time.

Expected result:

- `Not created` shows the first node as current and all later nodes as locked.
- Submitted shows the submitted node as current and the next-action panel says admin approval is
  pending.
- Timesheet rejection marks the submitted node red with an X, shows the rejection reason, and
  offers the correction path.
- Approved shows the approved node as current and enables the invoice upload form.
- Invoice upload shows the invoice node as current and the next-action panel says invoice review
  is pending.
- Invoice rejection marks the invoice node red with an X and offers the cancellation/corrected
  invoice flow.
- Invoice acceptance shows payment as the current step and identifies payment as the remaining
  admin action.
- Paid shows all five nodes as completed and no workflow action can be repeated.
- Every locked-node explanation is readable with both pointer hover and keyboard focus.
- The dashboard next-action CTA always opens the page where the stated action can be completed.

### Workflow Stepper Localization And Narrow Screens

1. Open `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}` in English.
2. Record the status, five workflow labels, locked explanations, invoice section, and next-action
   wording.
3. Change the language to Hungarian without changing the selected month.
4. Confirm the same workflow state remains selected and all recorded text is Hungarian.
5. Test the page at a narrow mobile viewport.
6. Move through the workflow nodes horizontally and focus each locked node.

Expected result:

- Changing language does not change the selected month or workflow state.
- Statuses, workflow labels, tooltips, locked-state explanations, and CTAs are bilingual.
- The five nodes remain readable on a narrow screen through horizontal scrolling.
- The stepper does not widen the whole page or overlap adjacent content.
- Keyboard focus remains visible and locked explanations are not hover-only.

### Contractor Can Submit Monthly Timesheet

1. Sign in as `{CONTRACTOR_EMAIL}`.
2. Ensure `{TIMESHEET_MONTH}` has at least one time entry with a description.
3. Ensure all projects in `{TIMESHEET_MONTH}` resolve to the same currency.
4. Open `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
5. Click `Submit timesheet`.
6. Confirm the dialog explains that source time entries will be locked.
7. Confirm the submit action.
8. Open `https://{DOMAIN_NAME}/time` and navigate to a week inside `{TIMESHEET_MONTH}`.
9. Try to edit or delete a submitted time entry.

Expected result:

- The timesheet status changes to submitted.
- The monthly preview switches to the submitted snapshot source.
- The selected month can no longer be submitted again.
- Source time entries in that month are locked and cannot be edited or deleted.
- The audit log contains a `timesheet.submitted` event for the submitted month.

### Contractor Cannot Submit Invalid Monthly Timesheet

1. Sign in as `{CONTRACTOR_EMAIL}`.
2. Open a month with no entries, missing rates, or mixed currencies.
3. Open `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
4. Check the submit button state.

Expected result:

- The submit button is disabled when the month has no entries, missing rates, or mixed currencies.
- The page shows a factual reason near the submit button.
- Missing rates and mixed currencies are also visible as warnings.

### Admin Can Approve Submitted Timesheet

1. Sign in as `{CONTRACTOR_EMAIL}`.
2. Submit `{TIMESHEET_MONTH}` from `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
3. Sign in as `{ADMIN_EMAIL}`.
4. Open `https://{DOMAIN_NAME}/admin/timesheets`.
5. Filter by `{CONTRACTOR_EMAIL}`, `{TIMESHEET_MONTH}`, or submitted status.
6. Open the submitted timesheet review.
7. Confirm the snapshot shows project totals, source lines, rates, currency, and amount.
8. Click `Approve timesheet`.
9. Reopen the contractor timesheet month.

Expected result:

- The admin review list is reachable from the sidebar approval menu.
- The submitted timesheet appears in the filtered admin list.
- The detail page reviews the immutable submitted snapshot, not live editable entries.
- Hours in the admin list, the review summary, the project snapshot, and every source line render
  decimal at two fraction digits (e.g. `9.50 h`) next to their amount, regardless of the admin's
  `Time display` preference.
- Approval changes the status to approved.
- Source time entries remain locked after approval.
- The audit log contains a `timesheet.approved` row.

### Admin Can Bulk Approve Submitted Timesheets

1. Prepare at least two submitted contractor timesheets and one timesheet in another status.
2. Sign in as `{ADMIN_EMAIL}`.
3. Open `https://{DOMAIN_NAME}/admin/timesheets`.
4. Filter the list so the prepared timesheets appear on the same page.
5. Confirm that only submitted rows have enabled selection checkboxes.
6. Select one submitted row and confirm the bulk action bar appears with the correct count.
7. Clear the selection and confirm the action bar disappears.
8. Use the header checkbox to select every submitted row on the current page.
9. Click the bulk approval action.
10. Reopen the approved rows and inspect the audit log.

Expected result:

- Non-submitted rows cannot be selected for bulk approval.
- Select all affects only submitted rows on the current page, not other pages or filtered-out rows.
- The action bar shows the selected count and keeps the current filters after approval.
- Every selected timesheet changes to approved, while non-selected rows remain unchanged.
- Each approved timesheet has its own approved workflow event and `timesheet.approved` audit row.
- Source time entries remain locked after bulk approval.

### Bulk Approval Rejects A Stale Selection

1. Open the same submitted timesheet list as `{ADMIN_EMAIL}` in two browser windows.
2. Select the same submitted timesheet in both windows.
3. Approve it from the first window.
4. In the second window, include that stale selection in a bulk approval attempt.

Expected result:

- The second bulk action reports that the selection changed and asks the admin to refresh.
- The entire second batch is rejected; it does not partially approve the other selected rows.
- No duplicate approval event or audit row is created for the already approved timesheet.

### Contractor Can Upload Invoice For Approved Timesheet

1. Sign in as `{CONTRACTOR_EMAIL}`.
2. Submit `{TIMESHEET_MONTH}` from `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
3. Sign in as `{ADMIN_EMAIL}`.
4. Open `https://{DOMAIN_NAME}/admin/timesheets`.
5. Open the submitted timesheet review.
6. Approve the timesheet.
7. Sign in again as `{CONTRACTOR_EMAIL}`.
8. Open `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
9. Confirm the contractor invoice panel is visible.
10. Enter `{INVOICE_NUMBER}`.
11. Enter `{INVOICE_AMOUNT}`.
12. Confirm the currency matches the approved timesheet currency.
13. Choose `{INVOICE_PDF_FILE}`.
14. Click `Upload invoice`.
15. Reopen the same month.

Expected result:

- The invoice panel is only available after admin approval.
- The PDF upload succeeds and the page confirms the invoice was uploaded.
- The timesheet status changes to invoiced.
- The invoice summary shows invoice number, amount, file name, upload time, and uploaded status.
- Uploading a second invoice for the same approved revision is blocked.
- The audit log contains an `invoice.uploaded` row.
- The timesheet event history contains an invoice uploaded event.

### Contractor Cannot Upload Invalid Invoice

1. Sign in as `{CONTRACTOR_EMAIL}`.
2. Open `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}` for a month that is not yet approved.
3. Confirm the invoice section is visible in a locked state, explains that admin approval is
   required, and does not show an upload form.
4. Submit and approve the month through the normal contractor and admin flow.
5. Return to `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
6. Try uploading without an invoice file.
7. Try uploading a non-PDF file.
8. Try uploading a PDF larger than 10 MB.
9. Try uploading with an empty invoice number.
10. Try uploading with a zero or negative amount.

Expected result:

- The contractor cannot upload an invoice before approval.
- The unavailable invoice step remains visible and explains how it becomes available.
- Invalid file, amount, and invoice number attempts show clear error messages.
- Invalid attempts do not change the timesheet status.
- Invalid attempts do not create invoice or document records.

### Admin Can Review And Accept Uploaded Invoice

1. Sign in as `{CONTRACTOR_EMAIL}`.
2. Submit `{TIMESHEET_MONTH}` from `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
3. Sign in as `{ADMIN_EMAIL}`.
4. Open `https://{DOMAIN_NAME}/admin/timesheets`.
5. Open the submitted timesheet review.
6. Approve the timesheet.
7. Sign in again as `{CONTRACTOR_EMAIL}`.
8. Open `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
9. Upload `{INVOICE_PDF_FILE}` with `{INVOICE_NUMBER}` and `{INVOICE_AMOUNT}`.
10. Sign in again as `{ADMIN_EMAIL}`.
11. Open `https://{DOMAIN_NAME}/admin/timesheets`.
12. Filter by invoiced status, `{CONTRACTOR_EMAIL}`, or `{TIMESHEET_MONTH}`.
13. Open the invoiced timesheet review.
14. Confirm the uploaded PDF is rendered inside the invoice reconciliation section.
15. Confirm the invoice metadata and declared amount are shown next to the system total.
16. Open the PDF in a separate tab from the review page.
17. Click `Accept invoice`.

Expected result:

- The uploaded PDF is visible to the admin before acceptance.
- The admin can compare the PDF manually with the approved timesheet totals.
- The review page shows whether the declared invoice amount matches the system amount.
- Accepting the invoice changes the timesheet status to accepted.
- The invoice status changes to accepted and can no longer be reviewed again.
- The audit log contains an `invoice.accepted` row.
- The timesheet event history contains an invoice accepted event.

### Admin Can Mark Accepted Invoice As Paid

1. Sign in as `{CONTRACTOR_EMAIL}`.
2. Submit `{TIMESHEET_MONTH}` from `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
3. Sign in as `{ADMIN_EMAIL}`.
4. Open `https://{DOMAIN_NAME}/admin/timesheets`.
5. Open the submitted timesheet review.
6. Approve the timesheet.
7. Sign in again as `{CONTRACTOR_EMAIL}`.
8. Open `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
9. Upload `{INVOICE_PDF_FILE}` with `{INVOICE_NUMBER}` and `{INVOICE_AMOUNT}`.
10. Sign in again as `{ADMIN_EMAIL}`.
11. Open the invoiced timesheet review.
12. Accept the invoice.
13. Confirm the invoice reconciliation section shows the paid action.
14. Click `Mark as paid`.
15. Reopen `https://{DOMAIN_NAME}/admin/timesheets`.
16. Filter by paid status, `{CONTRACTOR_EMAIL}`, or `{TIMESHEET_MONTH}`.
17. Open the paid timesheet review.
18. Sign in again as `{CONTRACTOR_EMAIL}`.
19. Open `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.

Expected result:

- The paid action is only visible after the invoice has been accepted.
- Marking as paid changes the timesheet status to paid.
- The contractor monthly preview shows the paid status.
- Source time entries remain locked.
- The same timesheet cannot be marked as paid again.
- The audit log contains a `timesheet.paid` row.
- The timesheet event history contains a paid event.

### Admin Can Reject Uploaded Invoice And Contractor Must Upload Cancellation Before Replacement

1. Sign in as `{CONTRACTOR_EMAIL}`.
2. Submit `{TIMESHEET_MONTH}` from `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
3. Sign in as `{ADMIN_EMAIL}`.
4. Open `https://{DOMAIN_NAME}/admin/timesheets`.
5. Open the submitted timesheet review.
6. Approve the timesheet.
7. Sign in again as `{CONTRACTOR_EMAIL}`.
8. Open `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
9. Upload `{INVOICE_PDF_FILE}` with `{INVOICE_NUMBER}` and `{INVOICE_AMOUNT}`.
10. Sign in again as `{ADMIN_EMAIL}`.
11. Open the invoiced timesheet review.
12. Confirm the uploaded PDF is rendered inside the invoice reconciliation section.
13. Enter `{INVOICE_REJECTION_REASON}` in the invoice rejection reason field.
14. Click `Reject invoice`.
15. Sign in again as `{CONTRACTOR_EMAIL}`.
16. Open `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
17. Confirm the invoice rejection reason is visible.
18. Confirm the page asks for a cancellation invoice before the corrected invoice.
19. Confirm the cancellation amount is the negative amount of the rejected invoice and cannot be changed.
20. Enter `{CANCELLATION_INVOICE_NUMBER}`.
21. Choose `{CANCELLATION_INVOICE_PDF_FILE}`.
22. Click `Upload cancellation invoice`.
23. Confirm the page now asks for the corrected invoice.
24. Enter `{CORRECTED_INVOICE_NUMBER}`.
25. Choose `{CORRECTED_INVOICE_PDF_FILE}`.
26. Confirm the corrected invoice amount and currency.
27. Click `Upload replacement invoice`.
28. Sign in again as `{ADMIN_EMAIL}`.
29. Open the invoiced timesheet review again.
30. Confirm the replacement PDF is rendered as the main invoice.
31. Confirm the cancellation invoice is visible as a related invoice document and can be opened.
32. Click `Accept invoice`.

Expected result:

- Rejecting an uploaded invoice changes the timesheet status to invoice rejected.
- The contractor sees the rejection reason and cannot upload the corrected invoice before the cancellation invoice.
- The cancellation invoice must be a PDF and must have the negative amount and same currency as the rejected invoice.
- Uploading the cancellation invoice does not change the timesheet back to invoiced yet.
- Uploading the corrected invoice moves the timesheet back to invoiced.
- The old rejected invoice is not accepted by accident.
- The admin can render the corrected PDF and open the related cancellation PDF before acceptance.
- Accepting the corrected invoice also accepts the uploaded cancellation invoice.
- The audit log contains `invoice.rejected`, cancellation `invoice.uploaded`, corrected `invoice.uploaded`, and `invoice.accepted` rows.
- The timesheet event history contains invoice rejected, cancellation upload, corrected upload, and invoice accepted events.

### Admin Can Reject And Unlock Submitted Timesheet

1. Sign in as `{CONTRACTOR_EMAIL}`.
2. Submit `{TIMESHEET_MONTH}` from `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
3. Sign in as `{ADMIN_EMAIL}`.
4. Open `https://{DOMAIN_NAME}/admin/timesheets`.
5. Open the submitted timesheet review.
6. Enter `{TIMESHEET_REJECTION_REASON}` in the rejection reason field.
7. Click `Reject and unlock month`.
8. Sign in again as `{CONTRACTOR_EMAIL}`.
9. Open `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
10. Confirm the rejection reason is visible.
11. Open `https://{DOMAIN_NAME}/time` and navigate to a week inside `{TIMESHEET_MONTH}`.
12. Edit one of the previously locked entries.
13. Return to `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}` and submit again.

Expected result:

- Rejection changes the status to rejected.
- The rejected month is unlocked for contractor edits.
- The contractor preview recalculates from current time entries after rejection.
- The rejection reason remains visible until resubmission.
- Resubmission creates a new revision.
- The audit log contains `timesheet.rejected`, and the timesheet event history includes rejected
  and unlocked events.

### Admin Can Fix Mixed-Currency Timesheet Blocking

1. Sign in as `{ADMIN_EMAIL}`.
2. Configure `{CONTRACTOR_EMAIL}` so `{TIMESHEET_PROJECT_A}` resolves to `{TIMESHEET_CURRENCY_A}` during `{TIMESHEET_MONTH}`.
3. Configure `{CONTRACTOR_EMAIL}` so `{TIMESHEET_PROJECT_B}` resolves to `{TIMESHEET_CURRENCY_B}` during `{TIMESHEET_MONTH}`.
4. Sign in as `{CONTRACTOR_EMAIL}`.
5. Add time entries with descriptions for both `{TIMESHEET_PROJECT_A}` and `{TIMESHEET_PROJECT_B}` inside `{TIMESHEET_MONTH}`.
6. Open `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
7. Confirm the submit button is disabled because the month contains multiple currencies.
8. Sign in again as `{ADMIN_EMAIL}`.
9. Open the admin rates page.
10. Open `{CONTRACTOR_EMAIL}` in the rate drawer.
11. Find the central rate or project override that causes `{TIMESHEET_PROJECT_A}` or `{TIMESHEET_PROJECT_B}` to resolve to the wrong currency.
12. Click `Replace` on that rate period.
13. Set `Replace from` to the first day of `{TIMESHEET_MONTH}`.
14. Enter the corrected rate amount and currency so every effective rate for `{CONTRACTOR_EMAIL}` in `{TIMESHEET_MONTH}` resolves to one currency.
15. Submit the replacement.
16. Confirm the rate is corrected for `{TIMESHEET_MONTH}`. If the selected date equals the period start, the same period is replaced in place; if it is later than the period start, the old period ends on that date and a replacement starts there.
17. Confirm the audit log contains rate replacement entries.
18. Sign in again as `{CONTRACTOR_EMAIL}`.
19. Reopen `https://{DOMAIN_NAME}/timesheets?month={TIMESHEET_MONTH}`.
20. Submit the timesheet.

Expected result:

- The mixed-currency month is blocked before the admin rate fix.
- The project breakdown shows which projects resolve to different currencies.
- Admin fixes the problem through rate period replacement, not by editing the timesheet amount directly.
- After the fix, the preview recalculates from current time entries and shows a single currency.
- The submit button becomes enabled and the timesheet can be submitted.

### Employee Cannot Open Timesheets

1. Sign in as `{EMPLOYEE_EMAIL}`.
2. Open `https://{DOMAIN_NAME}/timesheets`.
3. Check the sidebar and mobile navigation.

Expected result:

- The employee is shown an account-status message that contractor profile is required.
- The Timesheets navigation item is not visible for the employee.

## Payslips

Run admin scenarios as `{ADMIN_EMAIL}`. Run employee scenarios as `{EMPLOYEE_EMAIL}`. The employee
must have an active employee profile; contractor profiles must not be used for these tests.

### Admin Can Upload A Payslip

1. Sign in as `{ADMIN_EMAIL}` and open `https://{DOMAIN_NAME}/admin/payslips`.
2. In the month overview, click `{EMPLOYEE_EMAIL}` or choose `Upload payslip`.
3. Confirm the month selector shows January through December of the current year and initially selects the current month.
4. Use the previous-year and next-year buttons. Confirm each step replaces the grid with all 12 months of the adjacent calendar year, then return to the year containing `{PAYSLIP_MONTH}`.
5. Select `{EMPLOYEE_EMAIL}` and `{PAYSLIP_MONTH}`.
6. Upload `{PAYSLIP_PDF_FILE}` and submit.
7. Confirm the row appears in the history list with the employee, month, filename, upload date, and publisher.
8. Open Preview and confirm the embedded PDF renders.
9. Download the PDF and confirm the downloaded file is the uploaded document.

Expected result:

- Only employee profiles can be selected for upload.
- Month navigation is calendar-year based and does not limit older or future years.
- The PDF is private: preview and download work only through authenticated application access.
- The month overview increments its posted count and removes the employee from the missing list when applicable.
- Audit log entries exist for `payslip.uploaded`, `payslip.previewed`, and `payslip.downloaded`.

### Payslip File Validation And Replacement

1. On `https://{DOMAIN_NAME}/admin/payslips`, start an upload and select `{NON_PDF_FILE}`.
2. Confirm the form rejects the file before upload.
3. Upload `{PAYSLIP_PDF_FILE}` for `{EMPLOYEE_EMAIL}` and `{PAYSLIP_MONTH}` if no payslip exists yet.
4. Use Replace on that row.
5. Upload `{PAYSLIP_REPLACEMENT_PDF_FILE}` and confirm the replacement action.
6. Preview and download the row again.

Expected result:

- Non-PDF files, missing files, and files over 10 MB are blocked with a clear error.
- Replacement leaves exactly one current payslip for the selected employee/month.
- Preview and download use the replacement PDF, not the old PDF.
- Audit rows exist for `payslip.replaced` and the subsequent preview/download actions.

### Admin Can Delete And Reupload A Payslip

1. Find the `{EMPLOYEE_EMAIL}` / `{PAYSLIP_MONTH}` row in the admin payslip history.
2. Click Delete and confirm the destructive action.
3. Confirm the row is no longer in the current history list and the employee is shown as missing for the selected month when active.
4. Upload `{PAYSLIP_PDF_FILE}` for the same employee and month again.

Expected result:

- Deletion removes the current document and permits a later reupload for the same employee/month.
- An audit row exists for `payslip.deleted`.

### Employee Can Access Only Their Own Payslips

1. Sign in as `{EMPLOYEE_EMAIL}` and open `https://{DOMAIN_NAME}/payslips`.
2. Confirm the newest payslip is shown first and older months remain available below it.
3. Preview and download `{PAYSLIP_MONTH}`.
4. When the test employee has at least 14 historical payslips, use the history pager and confirm the older documents load on the next page while the newest payslip remains featured.
5. Copy the preview URL path from the browser network tools, sign in as a different employee or contractor, and open that same application URL.
6. As a contractor, confirm the Payslips navigation item is absent and open `https://{DOMAIN_NAME}/payslips` directly.

Expected result:

- The employee sees only their own documents and cannot upload, replace, or delete them.
- The employee history is retrieved in pages of 12 rather than loading every historical document.
- Another member cannot preview or download the employee's payslip through the application endpoint.
- Contractor profiles cannot access the payslip page and do not see it in navigation.

## Admin Projects

Run these tests as `{ADMIN_EMAIL}` with TOTP enabled and verified.

### Admin Can Open Projects Page

1. Open `https://{DOMAIN_NAME}/admin/projects`.
2. Confirm the page header and project counters load.
3. Confirm the create project form is visible.
4. Confirm the project directory and project groups sections are visible.

Expected result:

- The Projects admin page opens without errors.
- Existing projects, assignments, and groups load in the app shell.
- The page remains usable on laptop width without horizontal page overflow.

### Create Project

1. Open `https://{DOMAIN_NAME}/admin/projects`.
2. Fill the create project form:
   - Name: `{PROJECT_NAME}`
   - Slug/code: `{PROJECT_SLUG}`
   - Color: choose any non-default color.
   - Start date: today or a future date.
   - End date: leave empty.
   - Internal: test both checked and unchecked in separate runs.
   - Notes: optional.
3. Click `Create project`.
4. Refresh the page.

Expected result:

- A success message confirms the project was created.
- The project appears in the project directory after saving and after refresh.
- The selected color swatch is visible and is not white or blank.
- Internal projects show the internal marker.
- An audit row is recorded for `project.created`.

### Create Project Validation

1. Open `https://{DOMAIN_NAME}/admin/projects`.
2. Try to create a project with an empty name.
3. Try to create a project using an existing slug.
4. Try to create a project where the end date is before the start date.

Expected result:

- The form shows field-level validation errors.
- Duplicate slugs are rejected.
- Invalid date ranges are rejected.
- No invalid project appears in the project directory.

### Edit Project

1. Open `https://{DOMAIN_NAME}/admin/projects`.
2. Open `{PROJECT_NAME}` from the project directory.
3. Click the edit action.
4. Change:
   - Name: `{PROJECT_UPDATED_NAME}`
   - Slug/code: `{PROJECT_UPDATED_SLUG}`
   - Color: choose a different supported color.
   - Notes: update the note text.
5. Save changes.
6. Refresh the page.

Expected result:

- The project drawer opens with the current project values.
- The updated name, slug, color, and notes are visible after saving and after refresh.
- An audit row is recorded for `project.updated`.

### Activate And Deactivate Project

1. Open `https://{DOMAIN_NAME}/admin/projects`.
2. Open `{PROJECT_UPDATED_NAME}` from the project directory.
3. Deactivate the project.
4. Confirm the status changes to inactive.
5. Activate the project again.
6. Confirm the status changes back to active.

Expected result:

- Inactive projects are not available for new future time entry.
- Reactivated projects become available again when the assignment/date rules allow it.
- Audit rows are recorded for project status changes.

### Archive Project

1. Open `https://{DOMAIN_NAME}/admin/projects`.
2. Open an active or inactive test project.
3. Click `Archive`.
4. Confirm the archive dialog.
5. Refresh the page.

Expected result:

- A success message confirms the project was archived.
- Archived projects are removed from active working lists.
- Historical assignments and time entries remain available for reporting/audit purposes.
- An audit row is recorded for `project.archived`.

### Project Groups

1. Open `https://{DOMAIN_NAME}/admin/projects`.
2. In the project groups section, create a group named `{PROJECT_GROUP_NAME}`.
3. Add `{PROJECT_UPDATED_NAME}` to the group.
4. Remove `{PROJECT_UPDATED_NAME}` from the group.
5. Edit the group name to `{PROJECT_GROUP_UPDATED_NAME}`.
6. Archive the group.

Expected result:

- Created groups appear in the project groups section.
- Projects can be added to and removed from groups.
- Group changes affect organization and filters only; they do not change assignments or time entry.
- Archived groups disappear from active grouping helpers.
- Audit rows are recorded for group create/update/archive and project link changes.

### Project Directory Filters

1. Open `https://{DOMAIN_NAME}/admin/projects`.
2. Search by project name, slug, group name, assigned member name, and assigned member email.
3. Filter by project status.
4. Filter by internal/external project type.
5. Filter by timeline: active today, future, and ended.
6. Filter by project group and ungrouped projects.
7. Filter by assigned today and unassigned today.
8. Combine search with multiple filters.
9. Use the pager when more than one page is available.
10. Refresh the browser while filters are applied.
11. Clear filters.

Expected result:

- The directory updates to match each filter.
- The selected filters are represented in the URL and survive refresh.
- Pagination keeps the same filters while moving between pages.
- Clearing filters restores the full project directory.
- The layout remains responsive on laptop width.

### Project Group Filters

1. Open `https://{DOMAIN_NAME}/admin/projects`.
2. In the project groups section, search by group name.
3. Search by a project name that belongs to a group.
4. Filter groups by active and inactive state.
5. Filter groups by empty and with projects.
6. Combine group search with state and project-count filters.
7. Clear the group filters.

Expected result:

- The group list updates to match each filter.
- Empty results show a factual empty state.
- Clearing group filters restores the full group list.
- Adding or removing projects from a group still works while filters exist.

### Assign Member To Project

1. Open `https://{DOMAIN_NAME}/admin/projects`.
2. Open an active project.
3. In the assignment section, choose `{CONTRACTOR_EMAIL}` or `{EMPLOYEE_EMAIL}`.
4. Set start date `{PROJECT_ASSIGNMENT_START}`.
5. Leave end date empty.
6. Add note `{PROJECT_ASSIGNMENT_NOTE}`.
7. Click `Assign member`.
8. Refresh the page.

Expected result:

- Invited and active members can be assigned.
- The assignment appears after saving and after refresh.
- The assignment timeline and note are visible.
- Contractor assignments show whether they use the central rate or a project override.
- An audit row is recorded for `project_assignment.created`.

### Edit And Close Assignment

1. Open `https://{DOMAIN_NAME}/admin/projects`.
2. Open a project with an existing assignment.
3. Edit the assignment note and end date to `{PROJECT_ASSIGNMENT_END}`.
4. Save the assignment.
5. Close or end the assignment using the close action.

Expected result:

- Assignment edits are saved and visible after refresh.
- Closed assignments become inactive for future time entry outside their valid date range.
- Invalid date ranges are rejected.
- Audit rows are recorded for assignment update/close actions.

### Bulk Assignment

1. Open `https://{DOMAIN_NAME}/admin/projects`.
2. Open the bulk assignment dialog.
3. Select multiple members and multiple active projects.
4. Set start date `{BULK_ASSIGNMENT_START}`.
5. Add note `{PROJECT_ASSIGNMENT_NOTE}`.
6. Submit the bulk assignment.
7. Run the same bulk assignment again.

Expected result:

- New member/project assignment pairs are created.
- Existing overlapping assignment pairs are skipped, not duplicated.
- The summary shows created and skipped counts.
- Bulk assignment is limited to the configured maximum number of selected pairs.
- Audit rows are recorded for created assignments.

## Member Own Rates

### Employee Central Rate Timeline

1. Sign in as `{EMPLOYEE_EMAIL}`.
2. Open the avatar menu and select **My rates** / **Saját óradíjaim**.
3. Review the central-rate timeline.

Expected result:

- The header identifies the Employee profile.
- Only the employee's own central-rate periods are visible, newest first.
- The effective period is marked as current.
- Project-specific rate rows are not shown.
- Profile and settings remains a separate account-menu action.

### Contractor Effective Project Rates

1. Sign in as `{CONTRACTOR_EMAIL}`.
2. Open the avatar menu and select **My rates** / **Saját óradíjaim**.
3. Review the central timeline and project rows.
4. Use one assigned project with a current override and one assigned project without an override.

Expected result:

- The header identifies the Contractor profile.
- The contractor's complete central-rate timeline is visible.
- The overridden project shows the current override amount and **Project override**.
- The other project shows the current central amount and **Follows the central rate**.
- No other member's name, email, rate, or project assignment is visible.

### Missing Own Rate

1. Use a member with no current central rate.
2. For a contractor, ensure at least one current assignment also has no current override.
3. Open **My rates** / **Saját óradíjaim**.

Expected result:

- The page explains that no central rate is configured and tells the member to ask an admin.
- A contractor project without either rate shows **Not set**, not a manufactured zero value.
- The page remains read-only.

## Admin Rates

Run these tests as `{ADMIN_EMAIL}` with TOTP enabled and verified.

### Admin Can Open Rates Page

1. Open `https://{DOMAIN_NAME}/admin/rates`.
2. Confirm the rate list loads.
3. Search or scan for `{CONTRACTOR_EMAIL}` and `{EMPLOYEE_EMAIL}`.

Expected result:

- The Rates admin page opens without errors.
- Members are listed with profile, status, current central rate, and override count.
- The page remains usable on laptop width without horizontal page overflow.

### Add Central Member Rate

1. Open `https://{DOMAIN_NAME}/admin/rates`.
2. Open the rate drawer for `{CONTRACTOR_EMAIL}` or `{EMPLOYEE_EMAIL}`.
3. In the central rate section, add a period:
   - Start date: `{RATE_VALID_FROM}`
   - End date: leave empty.
   - Hourly rate: `{RATE_AMOUNT}`
   - Currency: `{RATE_CURRENCY}`
   - Note: `{RATE_NOTE}`
4. Save the rate.
5. Refresh the page.

Expected result:

- A success message confirms the central rate was created.
- The rate appears in the member's central rate timeline.
- The current rate shown in the list updates when the period is current.
- The actor and reason/note are visible in the rate timeline.
- An audit row is recorded for the rate creation.

### Add Future Central Rate With Currency Change

1. Open `https://{DOMAIN_NAME}/admin/rates`.
2. Open the rate drawer for a member who already has a central rate.
3. Add a second rate period:
   - Start date: `{RATE_FUTURE_MONTH_START}`
   - Hourly rate: `{RATE_UPDATED_AMOUNT}`
   - Currency: `{RATE_UPDATED_CURRENCY}`
   - Note: `{RATE_NOTE}`
4. Save the rate.

Expected result:

- Currency changes are accepted only when the new period starts on the first day of a future month,
  or today if today is the first day of the month.
- The previous open-ended period is closed at the new period start.
- The future rate appears as scheduled until it becomes current.

### Rate Validation

1. Open `https://{DOMAIN_NAME}/admin/rates`.
2. Try to create a rate with an empty start date.
3. Try to create a rate with zero or negative hourly amount.
4. Try to create a rate with an unsupported currency.
5. Try to create overlapping central rate periods.
6. Try to set a currency change starting mid-month.

Expected result:

- Invalid fields show validation errors.
- Unsupported currencies are rejected.
- Overlapping rate periods are rejected.
- Currency changes that violate month-boundary rules are rejected.
- No invalid rate period is saved.

### Contractor Project Override Rate

1. Open `https://{DOMAIN_NAME}/admin/rates`.
2. Open the rate drawer for `{CONTRACTOR_EMAIL}`.
3. In project overrides, choose an assigned project.
4. Add an override period:
   - Start date: `{RATE_VALID_FROM}`
   - Hourly rate: `{RATE_AMOUNT}`
   - Currency: `{RATE_CURRENCY}`
   - Note: `{RATE_NOTE}`
5. Save the override.
6. Refresh `https://{DOMAIN_NAME}/admin/projects` and open the same project assignment.

Expected result:

- The override appears under the selected contractor/project assignment.
- The project assignment indicates that a project override exists.
- Other projects for the same contractor continue to use the central rate.
- An audit row is recorded for the override creation.

### Multiple Project Overrides

1. Open `https://{DOMAIN_NAME}/admin/rates`.
2. Open the rate drawer for `{CONTRACTOR_EMAIL}`.
3. Add an override for one assigned project.
4. Add an override for a different assigned project.
5. Add another future period to one existing project override.

Expected result:

- Overrides can exist for multiple projects for the same contractor.
- Adding a future period to one project does not hide the option to add another project override.
- The drawer groups override timelines by project.

### Employee Override Guard

1. Open `https://{DOMAIN_NAME}/admin/rates`.
2. Open the rate drawer for `{EMPLOYEE_EMAIL}`.
3. Look for project override controls.

Expected result:

- Employees have central internal rates only.
- Project-specific override controls are not available for employees.

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

### Search, Filter, And Page Members

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/people`.
3. Search for a known member name or email.
4. Filter by state, role, and profile.
5. Move to the next page if more than one page is available.
6. Clear the filters.

Expected result:

- The member list shows 20 members per page by default.
- Search matches member name and email.
- State, role, and profile filters update the URL query string.
- Pagination keeps the selected filters.
- Clearing filters returns to the unfiltered first page.

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

### Resend Expired Invitation

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/people`.
3. Find a member with state `invited` whose previous invitation link has expired.
4. Click the resend invitation action.

Expected result:

- A success message confirms the invitation was resent.
- The invited email receives a new invitation link.
- The old expired invitation link remains unavailable.
- The new invitation link can be accepted.

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

### Restore Archived Member

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/people`.
3. Find an archived member.
4. Click the restore account action.
5. Refresh `https://{DOMAIN_NAME}/admin/people`.

Expected result:

- A success message confirms that the member was restored.
- If the archived member had a linked auth account, the member becomes active and can sign in again.
- If the archived member had no linked auth account, the member becomes invited and receives a new invitation email.
- Previously revoked sessions are not restored.
- Historical records remain attached to the restored member.
- An audit row is recorded for `member.restored`.

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

### Admin Reset Member Authenticator

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified in one browser profile.
2. Use a second browser profile to sign in as `{CONTRACTOR_EMAIL}` or `{EMPLOYEE_EMAIL}` with TOTP
   enabled.
3. In the admin browser, open `https://{DOMAIN_NAME}/admin/people`.
4. Find the contractor or employee row.
5. Open the row actions menu and click `Reset authenticator`.
6. Confirm `Reset authenticator`.
7. In the contractor or employee browser, refresh `https://{DOMAIN_NAME}/dashboard`.
8. Sign in again as the contractor or employee.

Expected result:

- The admin sees a success message that the authenticator app was reset.
- The contractor or employee is signed out because active sessions were revoked.
- The next sign-in no longer asks for the old TOTP code or old backup codes.
- The user can open `/settings` and set up a new authenticator app.
- The admin cannot reset their own authenticator from this table.
- Audit rows are recorded for `security.totp_reset` and `member.session_revoked` without TOTP
  secrets or backup-code values.

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

### Duration Display Preference

1. Sign in as any active user and open `https://{DOMAIN_NAME}/settings`.
2. Open `Preferences` and select `Decimal hours` under time display.
3. Save, then open the dashboard, time tracking, and any available timesheet screen.
4. Confirm a 3-hour 23-minute duration appears as `3.38 h` where an hour unit is shown — never more
   than two decimal digits anywhere.
5. On `/time`, log a 55-minute entry (e.g. start `09:00`, end `09:55`) and confirm the live duration
   badge, the grid cell, and the week total all read `0.92 h` / `0.92` / a total consistent with the
   other entries logged that week — not `0.9167 h`.
6. Return to Preferences, select `Hours and minutes`, and save.
7. Reopen the same screens and refresh the browser.
8. On `/time`, type `3:23` directly into an empty grid cell and confirm it saves as 203 minutes and
   redisplays as `3:23`.
9. Switch the interface language to Hungarian and repeat step 7.

Expected result:

- The preference survives refresh and a new sign-in.
- The same 203 stored minutes appear as `3:23` under the hours-and-minutes preference — identical in
  Hungarian and English, since this format is locale-neutral (no `ó`/`p` split).
- Changing the display does not alter time entries, totals, rates, or calculated amounts.
- The audit log records `member.duration_display_format_updated`.
- On the contractor's own timesheet summary, the admin timesheet review screen, and the line-level
  hours edit field on `/admin/reports`, hours always render as decimal (e.g. `9.50 h`) next to the
  amount they were billed at, regardless of which display preference is selected — these screens
  intentionally do not follow the preference because the amount beside them must stay checkable
  against hours × rate.

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

- The user lands on `/dashboard`, even when authenticator-app 2FA is enabled.
- The app does not show `/two-factor` after a user-verified passkey login.
- If the passkey belongs to an admin account without authenticator-app setup, normal pages open but
  admin screens still redirect to `/settings?setup=required&...reason=admin-totp-required...`.

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
3. If the account has email/password enabled, enter the current password in the authenticator-app
   section.
4. Click `Set up authenticator`.
5. Scan the displayed QR code with `{AUTHENTICATOR_APP}`.
6. Enter the current 6-digit code.
7. Click `Verify and enable`.

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

### Passkey Login With TOTP Enabled

1. Make sure TOTP is enabled for `{ADMIN_EMAIL}` or `{CONTRACTOR_EMAIL}`.
2. Make sure the same account has a registered passkey on `{PASSKEY_DEVICE}`.
3. Sign out.
4. Open `https://{DOMAIN_NAME}/login`.
5. Click `Continue with passkey`.
6. Complete the passkey prompt on `{PASSKEY_DEVICE}`.

Expected result:

- The passkey prompt requires normal device verification, such as biometrics, PIN, or password.
- The app redirects to `/dashboard` or the original callback URL.
- The app does not show `/two-factor`.
- Signing out and using password, magic link, or Google on an untrusted browser still shows
  `/two-factor` for the same TOTP-enabled account.

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
3. If the account has email/password enabled, enter the current password in the authenticator-app
   section.
4. Click `Disable` in the authenticator-app section.
5. Confirm the browser prompt.
6. Sign out and sign in again.

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
3. If the account has email/password enabled, enter the current password in the authenticator-app
   section.
4. Click `New backup codes`.
5. Confirm the browser prompt.
6. Store one of the newly displayed backup codes.
7. Sign out and sign in until `/two-factor` is shown.
8. Open the `Backup code` tab.
9. Enter the stored new backup code.
10. Try one of the older backup codes from before regeneration.

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

## Reports And PDF Export

### Filter Report Data

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/reports`.
3. Switch between month, week, day, year, and custom period filters.
4. Filter by project, project group, and member.
5. Switch between user view and project view.
6. Clear filters.

Expected result:

- The report updates for each period mode and filter.
- User view groups by people.
- Project view groups by projects.
- The selected filters are reflected in the URL and survive browser refresh.
- Clearing filters returns to the default monthly report.
- The donut chart's center label shows exactly one hour unit (e.g. `3.38 h`), never a doubled or
  mismatched unit, in every display-preference and locale combination.

### Edit Report Rows And Save Optional Corrections

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/reports` and choose filters that include multiple time entries.
3. Note the total hours, one group total, and one row's description and hours.
4. Click `Edit` above the itemized breakdown.
5. Change the noted row's description and hours, typing a value like `3:30` or `3h 20m` into the
   hours field.
6. Confirm the report totals, group total, charts, and itemized row update immediately.
7. Type `0` into another row's hours field and tab away; separately, type an unparseable value like
   `abc` into a row's hours field and tab away.
8. Click `Editing done`.
9. Confirm the edited row carries a visual edit indicator.
10. Confirm a prominent unsaved-change bar remains visible after leaving edit mode.
11. Click `PDF export` and inspect the preview.
12. Leave `Save edits to recorded time` off, download the PDF, then close the dialog.
13. Confirm the unsaved-change bar is still present after the export dialog closes.
14. Refresh the report and confirm the original values return.
15. Repeat the edit, click `Save to recorded time` on the report page, enter a correction reason,
    and confirm.
16. Open the affected member's week on `/time`.
17. Repeat with another edit by selecting `Save edits to recorded time` inside the PDF export
    dialog, enter a reason, and download the PDF.

Expected result:

- Edit mode replaces row descriptions and hours with in-place inputs without changing the row's
  member, project, or date.
- The hours field accepts the same duration formats as the `/time` grid (`3.5`, `3:30`, `3h 20m`,
  `200m`) and commits the parsed duration exactly, with no float rounding drift. Typing `0` or an
  unparseable value is rejected: the field reverts to the row's last committed value instead of
  silently saving a zero or truncated duration.
- The information banner states that changes remain report-only until explicitly saved.
- Totals, grouped summaries, charts, PDF preview, and the downloaded PDF all use the working-copy
  values consistently.
- Completing edit mode keeps the working-copy changes on the current page but does not persist them
  to the underlying time entries.
- Exporting without the save option leaves the working-copy edits visible after the dialog closes;
  refreshing restores the values from recorded time.
- Saving from either the report page or export dialog requires a reason and permanently updates the
  source entry. A duration correction removes the old start/end interval so it cannot contradict
  the corrected total.
- The affected member's week shows an admin-correction banner. The entry shows the admin name,
  correction time, and reason in the day view, entry editor, and multi-entry breakdown.
- The audit log contains `time_entry.admin_updated` with before/after values and the correction
  reason. It must not store only a generic `time_entry.updated` event for this operation.
- Saving is rejected if an affected entry belongs to a submitted/locked timesheet period or if the
  correction would make a day exceed 24 hours; the unsaved working copy remains available.
- Hungarian and English modes translate the edit action, completion action, information banner,
  persistence controls, member correction notice, and accessible input labels.

### Configure Export Dialog

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/reports` and choose filters that include tracked time.
3. Confirm the page header carries only the `PDF export` button — no export title field and no
   content dropdown.
4. Click `PDF export` and wait for the preview.
5. Type a new export title one character at a time and watch the preview.
6. Switch the content selection to internal, then back to cost-free.
7. Switch time display between decimal hours and hours/minutes and compare the preview.
8. Resize the window down to a narrow width.
9. Close the dialog with the `X`, with `Escape`, with `Cancel`, and by clicking outside it. Reopen it
   after each.

Expected result:

- The dialog opens with the export title prefilled from the current period, cost-free selected, and
  `PDF document` shown as the only format.
- The preview pane renders the real report document as a white page, one image per page of the
  export, on the tinted panel behind it.
- Typing does not re-render the preview on every keystroke: the preview refreshes once, roughly half
  a second after typing stops, and the heading it shows then matches the title field.
- A refresh never blanks the preview. The pages already on screen stay put and keep their scroll
  position while the new render runs; a `Rendering the preview…` note appears next to the `PREVIEW`
  label, stays visible even when the pages are scrolled past, and the new pages replace the old ones
  in place. Switching content back and forth quickly does not make the pane strobe.
- Selecting internal reveals the amber `Cost data is visible` warning, the preview gains rate and
  cost columns plus a cost metric, and the time-display selector becomes disabled with a hint
  explaining that internal exports always show decimal hours so they stay checkable against the
  amounts beside them. Selecting cost-free re-enables the selector and removes the warning and cost
  columns again.
- The time-display selector defaults to the admin's saved preference for a cost-free export. Decimal
  mode renders 203 minutes as `3.38 h`; hours/minutes mode renders it as `3:23` — identical in both
  Hungarian and English, since the hour-minute format is locale-neutral. Switching to internal
  forces the selector to `Decimal hours` and greys it out; the preview and the downloaded PDF render
  `3.38 h` for internal exports regardless of what the selector showed before switching.
- The footer states the time zone the report was cut on, matching the admin's own time zone.
- Below roughly 48rem the two panes stack instead of scrolling sideways, and the page never scrolls
  horizontally.
- Every close route dismisses the dialog and returns focus to the `PDF export` button. Reopening
  resets the title, content selection, and time display to their defaults.
- The dialog title, both content labels and hints, the warning, the format row, the preview label,
  the time zone label, `Cancel` and `Download PDF` are all translated in Hungarian and English.
- Both themes are legible: the config rail and footer follow the theme, while the preview page stays
  white in dark and light alike, because it is the printed document.

### Export Preview Fidelity And Limits

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/reports`, pick a period long enough to fill more than one page,
   and open the export dialog.
3. Scroll the preview pane to the last page.
4. Download the PDF and compare it page by page against what the preview showed.
5. Pick a period with more than 12 pages of tracked time, if the data allows it.
6. Filter down to a period with no tracked time and look at the `PDF export` button.
7. Open the audit log and count the `report.exported` rows created while previewing.

Expected result:

- The preview shows every page of the document, not only the first, in order.
- The downloaded PDF matches the preview: same title, same columns, same totals, same page count.
- Beyond 12 pages the preview stops and says it is showing the first 12 pages, while the download
  still contains all of them.
- With no tracked time in range the `PDF export` button is disabled and the dialog cannot be opened.
- Previewing records no `report.exported` audit rows, creates no report export or document rows, and
  writes nothing to object storage. Only the actual download does.

### Export Cost-Free PDF

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/reports`.
3. Choose filters that include tracked time.
4. Click `PDF export`.
5. Enter `{REPORT_EXPORT_TITLE}` as the export title.
6. Keep cost-free content selected.
7. Click `Download PDF`.
8. Open the downloaded PDF.
9. Search the PDF for hourly rate, amount, and currency values that should only appear internally.

Expected result:

- A PDF downloads successfully.
- The export title appears at the top of the PDF.
- The PDF contains hours, dates, projects or members, and descriptions.
- The PDF does not contain hourly rates or calculated amounts, and does not name the export mode.
- An audit row is recorded for `report.exported`.

### Export Internal PDF

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/reports`.
3. Choose filters that include tracked time with configured rates.
4. Click `PDF export`.
5. Enter `{INTERNAL_REPORT_EXPORT_TITLE}` as the export title.
6. Select internal content.
7. Click `Download PDF`.
8. Open the downloaded PDF.

Expected result:

- A PDF downloads successfully.
- The PDF contains hours, hourly rates, currencies, and calculated amounts.
- Every hours figure in the PDF renders decimal at two fraction digits (e.g. `9.50 h`), regardless
  of the admin's saved time-display preference, so it stays checkable against the amount beside it.
- Missing rates are marked with an em dash and explained in a footnote, not silently
  calculated as zero.
- An audit row is recorded for `report.exported`.

### Export Runtime Configuration

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/reports`.
3. Export a PDF from an environment where object storage and Typst are configured.
4. Repeat in an environment where Typst is intentionally not available, if such an environment exists.
5. In that same environment, open the export dialog and read the preview pane.

Expected result:

- With object storage and Typst configured, the export succeeds.
- Without Typst, the export fails with a clear server error instead of a broken or empty PDF.
- Without object storage, the export fails and no report export metadata is left behind.
- Without Typst, the preview pane shows a translated failure message and a retry button rather than
  an empty white page, and the message does not leak the binary path or the renderer's stderr.

### Export Template Rendering And Localization

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Set the interface language to Hungarian, open `https://{DOMAIN_NAME}/admin/reports`, and export
   both a cost-free and an internal PDF with the `PDF language` selector left on `Magyar`.
3. Switch the interface language to English, keep the `PDF language` selector on `English`, and
   export both again.
4. Open all four PDFs.

Expected result:

- Every PDF renders in the language chosen in the dialog: headings, table headers, the
  confidentiality pill, the scope facet labels, the `Generated` label, the `Total` row, the footer
  page label, and the footnotes.
- Hungarian accented characters (`ő`, `ű`, `á`, `é`, `í`) render correctly and are not replaced by
  boxes or blank glyphs. The body font is Inter in both languages.
- Dates never wrap onto a second line inside the date column, in either language.
- Cost-free PDFs contain no rate, amount, or currency values anywhere, including in the summary
  band and the breakdown table.
- A report whose lines have missing rates shows a warning banner, an em dash in the affected rate
  and amount cells, and a footnote explaining the em dash — never a zero amount.

### Export Language Independent Of The Interface

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Set the interface language to Hungarian and open `https://{DOMAIN_NAME}/admin/reports`.
3. Click `PDF export` and read the `PDF nyelve` selector.
4. Select `English` and wait for the preview to re-render.
5. Type `{REPORT_EXPORT_TITLE}` over the generated title, switch back to `Magyar`, then to `English`
   again.
6. Click `Download PDF` and open the PDF.
7. Switch the interface language to English, reopen the dialog, select `Magyar`, and download again.
8. Reopen the dialog after both downloads.

Expected result:

- The selector is a two-pill toggle matching the `User view` / `Project view` pills on the reports
  page, reachable by keyboard with the arrow keys moving the selection, in both dark and light theme.
- The dialog's own labels and buttons stay in the interface language; only the preview and the PDF
  follow the selector.
- Selecting `English` re-renders the preview in English within about a second, and the generated
  title switches from `Időriport - …` to `Time report - …`.
- A hand-typed title survives every later language switch; it is never overwritten.
- Both PDFs render fully in the language the selector showed at download time, with the app chrome
  in the other language — proving the two directions are independent.
- Reopening the dialog resets the selector to the interface language, the generated title, and
  cost-free content.

### Export Document Design

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/reports`, choose a period with enough tracked time to fill
   more than one page, and export both a cost-free and an internal PDF.
3. Read the header block, the summary band, and both tables in each PDF.
4. Search both PDFs for the words `internal`, `cost-free`, `belső`, and `költségmentes`.
5. Print or preview one PDF on paper.

Expected result:

- Neither PDF names its export mode anywhere. Both carry the same `Confidential` pill, and the
  header states the scope instead: view, period, and the project, project group and member filters,
  with an open filter spelled out as `All projects` / `All members`.
- An internal export is distinguishable from a cost-free one only by its rate and amount columns
  and its amount metric.
- The summary band never leaves an orphaned metric on a second row: four metrics for a cost-free
  export, five for an internal one, on a single row.
- Numeric columns are right-aligned, decimal points line up down each column, and every table has
  alternating row tints.
- Each table ends with one `Total` row. It appears only after the last row of the table, never at
  the foot of a page the table continues past.
- The column header row repeats at the top of every page a table spans, and the footer reads
  `Page 2 / 3` style page numbers.
- Group rows carry a member initials chip in user view and a project colour dot in project view;
  the dot colour matches the project colour on screen.
- The share column shows a bar whose length matches its percentage, and the bar is still visible
  for a group rounding to `0%`.
- The printed page is white with tinted panels and table rows, not a full-page cream background.

### Export Scoped To One Project Or One Member

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/reports`, select a single project, keep user view, and export
   both a cost-free and an internal PDF.
3. Switch to project view, clear the project filter, select a single member, and export both again.
4. Select a single project _and_ a single member together, and export once more.
5. Repeat step 2 with a project group selected instead of a single project.

Expected result:

- With one project selected, no PDF repeats the project name down a column. The project appears
  once, in the header `Project` facet, next to a dot in its own project colour.
- The internal details table drops its `Project` column and keeps `Member`; the description column
  takes over the freed width.
- The cost-free details table replaces its `Project` column with `Member`, so every row is still
  attributable to someone. It never ends up with only a date, a description and hours while more
  than one member contributed.
- With one member selected in project view, the reverse happens: the `Member` column disappears and
  the cost-free table shows `Project` instead.
- With both a single project and a single member selected, both identifying columns are gone, the
  details table is date, description and hours, and the header names both.
- The `Projects` metric disappears from the summary band for a single-project export, and `People`
  disappears for a single-member export. No metric reads `1`.
- The breakdown section is omitted entirely when the report has only one group row, since its
  totals would restate the summary band. The details table still ends with its own `Total` row.
- Selecting a project _group_ changes nothing about the columns: a group spans several projects, so
  the `Project` column and the `Projects` metric both stay.

### Export Templates Present In The Deployed Image

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/admin/system`.
3. Read the Typst PDF renderer check.
4. Export any report PDF.

Expected result:

- The Typst PDF renderer check passes, which also confirms the `.typ` templates and the bundled
  Inter fonts were included in the deployed image, not only that the Typst binary exists.
- If the check fails with a message naming a templates directory, the deployment is missing
  `src/server/pdf/templates`; the export will fail the same way.

## Audit Log

### Open Audit Watcher

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `{AUDIT_LOG_VIEW}`.
3. Click `Refresh`.
4. Enable `Watch`, wait at least 15 seconds, then disable it.

Expected result:

- The audit log opens for admins.
- The page shows matching event count, pagination, filters, and event rows.
- Refresh and Watch update the event list without signing the admin out.
- Non-admin users cannot open `{AUDIT_LOG_VIEW}`.

### Search And Filter Audit Rows

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `{AUDIT_LOG_VIEW}`.
3. Search for a known event action, for example `member.updated` or `security.totp_reset`.
4. Filter by event, target type, actor, and a date range.
5. Clear the filters.

Expected result:

- Search and filters update the URL query string.
- Rows match the selected criteria.
- Clearing filters returns to the unfiltered first page.
- Pagination keeps the selected filters.

### Audit Details Redaction

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `{AUDIT_LOG_VIEW}`.
3. Open `Details` for a security or member lifecycle event.

Expected result:

- The details dialog shows actor, target, request metadata, and before/after JSON.
- Sensitive-looking keys such as password, token, secret, backup code, and credential values are
  displayed as `[redacted]`.
- Closing the dialog returns to the same filtered audit list.

## Help And Manual

### Read Help Welcome Content

1. Sign in as `{EMPLOYEE_EMAIL}`, `{CONTRACTOR_EMAIL}`, or `{ADMIN_EMAIL}`.
2. Open `{HELP_VIEW}`.
3. Select the `Welcome` tab.

Expected result:

- The Help page opens for active users.
- The Welcome tab shows the published admin-maintained markdown content.
- If no admin content has been published yet, the page shows the source default welcome content.
- Signed-out users cannot open `{HELP_VIEW}`.

### Read Manual With Role-Based Visibility

1. Sign in as `{EMPLOYEE_EMAIL}`.
2. Open `{HELP_VIEW}` and select the `Manual` tab.
3. Confirm general topics, such as dashboard, time tracking, and security settings, show full text.
4. Confirm contractor-only and admin-only topics are visible as topic names but show only a generic restricted message.
5. Sign out and repeat as `{CONTRACTOR_EMAIL}`.
6. Sign out and repeat as `{ADMIN_EMAIL}`.

Expected result:

- Employees can read only topics for functions they can use.
- Contractors can read contractor timesheet/invoice topics in addition to general topics.
- Admins can read every manual topic.
- Restricted topics do not expose detailed operational instructions.

### Admin Publishes Welcome Content

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `{ADMIN_INFO_VIEW}`.
3. Enter `{HELP_WELCOME_TITLE}` as the title.
4. Enter `{HELP_WELCOME_MARKDOWN}` as the markdown body.
5. Confirm the live preview updates.
6. Click `Publish`.
7. Open `{HELP_VIEW}` and select the `Welcome` tab.

Expected result:

- The admin editor is available only to admins.
- The live preview renders the controlled Markdown subset.
- Publishing stores a new immutable version and shows a success message.
- After publishing, the editor shows the stored (trimmed) title and body, the new version number,
  and an updated-at timestamp formatted in the selected interface language.
- The Help Welcome tab shows the newly published content.
- An audit row is recorded for `info_pages.publish`.

### Help Navigation

1. Sign in as `{ADMIN_EMAIL}`.
2. Open `https://{DOMAIN_NAME}/dashboard`.
3. Click the sidebar Help link.
4. Click the admin `Information page` navigation item.

Expected result:

- The sidebar Help link opens `{HELP_VIEW}` and highlights Help.
- The admin Information page navigation item opens `{ADMIN_INFO_VIEW}`.
- Non-admin users do not see or access `{ADMIN_INFO_VIEW}`.

## Navigation

### Sidebar Real Routes

1. Sign in as `{ADMIN_EMAIL}` with TOTP enabled and verified.
2. Open `https://{DOMAIN_NAME}/dashboard`.
3. Click `Irányítópult` in the sidebar.
4. Click `Emberek` in the sidebar.
5. Click `Napló` in the sidebar.

Expected result:

- `Irányítópult` opens `/dashboard`.
- `Emberek` opens `/admin/people`.
- `Napló` opens `/admin/audit`.
- The current sidebar item is highlighted.

## Appearance

### Theme Preference

1. In the browser devtools console run `localStorage.removeItem("theme")`, set the operating system
   to light appearance, and hard-reload `https://{DOMAIN_NAME}/dashboard`.
2. Open the theme control in the header (next to `HU | EN`) and pick `Sötét` / `Dark`.
3. Navigate to `/time`, then reload the page.
4. Pick `Rendszer` / `System`, then flip the operating system appearance while the tab stays open.
5. Open a second tab on `/dashboard` and change the theme there.
6. Below the `md` breakpoint, open the navigation drawer and use the theme and language controls in
   its footer.
7. Sign out and repeat step 2 on `/login`.

Expected result:

- With no stored preference the app follows the operating system, and the light theme paints with no
  dark flash at any point during load.
- The header control shows a sun in light and a moon in dark, and the open menu marks the active
  preference.
- The chosen theme survives navigation, reload, and a language change.
- On `System`, flipping the operating system appearance re-themes the open tab without a reload.
- Changing the theme in one tab re-themes the other.
- In light theme the sidebar and mobile drawer are white (not near-black), the page wash is warm, and
  dialogs, dropdowns, and popovers stay readable.
- The drawer footer controls work on mobile and match the header behaviour.
- The auth screens offer the same three options with the same labels in both locales.

### Design Token Fidelity Against The Prototype

Reference screens live in `claude_design_proto/screenshots` (gitignored). The prototype remains
the reference for the **light** theme; the dark theme follows `docs/dark-mode-redesign.md`
("Graphite Aurora") instead, so dark prototype screenshots are historical — compare dark against
the checked-in visual baselines and the scenario below.

1. Open `/dashboard` in dark theme and compare against `shell-dark-admin.png` and `dash-admin-dark.png`.
2. Confirm the page canvas shows a faint mint glow off the **top-right** corner and a faint peach
   glow off the **bottom-left**, over a near-black graphite base — not a flat fill.
3. Switch to light theme. The canvas base is a warm beige that lightens toward white at the top-right.
4. On both themes check a card: it is fully opaque, with no gradient showing through it.
5. Hover a clickable card. It rises slightly, its border strengthens, and it gains one soft shadow.
6. In light theme confirm shadows read teal-grey, not black.
7. Check status pills on `/timesheets` or the review queue: a soft tint fill, tone-coloured text,
   and a faint border of the same hue. The neutral pill keeps the standard border.
8. Check a primary button: a mint gradient with a soft glow beneath it, not a flat fill.
   Check the amber CTA button hovers to a deeper amber.
9. Open a dialog and a drawer. The backdrop is a near-black scrim with a slight blur.
10. Open a dropdown, a select and a tooltip. Each has a visible stronger border; the tooltip sits on
    the tertiary surface, not the card colour.
11. Trigger a loading state and confirm skeletons sweep a sheen across themselves rather than pulsing.
12. Compare `/time` against `timegrid-dark.png` and `/admin/reports` against `rp-main.png`.
13. Repeat steps 4–12 in the other theme.

Expected result:

- Both glows are visible on every app page in both themes.
- Card, table, panel and popover surfaces are opaque and match the prototype's surface colour.
- Every tone tint (success, warning, danger, accent) uses one consistent strength per theme, and in
  light theme reads as a solid pastel rather than a washed-out dark colour.
- Table headers have no fill of their own, just a hairline rule, in the subtle text tier.
- Placeholders sit one step lighter than body copy.
- Nothing regresses at mobile widths, and the collapsed sidebar rail is 76px.

### Graphite Aurora Dark Theme

1. Open `/dashboard` in the dark theme and look at the overall colour of the chassis: page,
   sidebar, cards, dividers.
2. Compare the sidebar against the page canvas, then hover an inactive navigation item and look at
   the active one.
3. Find a screen showing several status pills together (`/timesheets`, the review queue) and a
   dashboard distribution bar with success, warning, and danger segments side by side.
4. Look at the page gutters on `/dashboard` — the margins around and below the cards — then at a
   dense table screen, then at `/login`.
5. Enable "reduce motion" in the operating system and reload `/dashboard` and `/login`.
6. Open `/time` and any form: click into an input.
7. Open `/admin/reports` and check the donut, the horizontal bars, and the utilization trend in
   both themes.
8. Switch to the light theme and check an "Approved" pill and a rejected/danger state, then switch
   back to dark and check the same rows.

Expected result:

- The chassis is neutral graphite — no green or teal cast on the page, cards, hovers, or borders.
  Body text reads warm off-white, not mint-tinted. Mint appears only as a signal: the active nav
  item, focus rings, links, the primary button, the running timer.
- The sidebar is darker than the canvas and recedes; the active item carries a soft mint tint, a
  bright label, and a thin gradient rail on its left edge; inactive items sit in the quiet third
  text tier until hovered.
- Every pill tone is distinguishable at a glance — danger is unmistakably rose, warning amber,
  success green, info mint — each with a faint border of its own hue. The distribution bar's three
  segments never read as two warm blushes.
- The gutters show a faint dot lattice, a barely-there grain, and the brand shapes as soft light:
  two blob glows whose silhouettes are readable via their thin outline echoes, a wave ridge along
  the bottom, and a line-art swoosh off the top-right corner. None of it shows through cards,
  tables, or dialogs, and a dense financial table stays calm. The auth screen shows the same
  atmosphere behind the form panel only, never over the teal brand panel.
- With reduce motion on, the corner glows sit still, centred and unscaled, and the page looks
  composed — nothing is caught mid-drift.
- Inputs sit slightly below the surface (a darker inset fill in dark, a warm cream fill in light)
  with a visible border and a bright mint focus ring.
- Report series follow one fixed colour order — mint, amber, violet, green, rose, blue — in both
  themes; a series keeps its colour when filters change, and every mark is readable on its card.
- "Approved" is the same green and "rejected" the same rose in both themes — the hue does not
  drift between light and dark, and the pill text stays readable on its tint in both.

### Rollout IT Brand Mark

1. Open `https://{DOMAIN_NAME}/dashboard` in the dark theme and look at the top of the sidebar.
2. Switch to the light theme without reloading.
3. Collapse the sidebar with `Oldalsáv összecsukása` / `Collapse sidebar`, then reload the page.
4. Below the `lg` breakpoint, open the navigation drawer and look at its header.
5. Sign out, then look at the brand tile on the teal panel of `/login` in both themes, and at mobile
   width where the panel becomes a banner.
6. With devtools open on the network tab, hard-reload and filter for `rolloutit`.

Expected result:

- The sidebar shows the Rollout IT pictogram instead of the old `SH` tile, with `Sheet Happens` and
  the subtitle beside it.
- The mark is cream in the dark theme and deep teal in the light theme, and it swaps the instant the
  theme changes — no reload, no flash of the wrong colour, and never a light mark on a white surface.
- The collapsed rail keeps the mark centred at the same size, and a reload paints the correct colour
  straight away.
- The mobile drawer header shows the same mark.
- The auth panel keeps its frosted tile and shows the cream mark in **both** themes — the panel is
  teal either way, so a deep-teal mark there would be a bug, not a theme.
- Both files are requested once and the mark stays crisp on a retina display.

### Auth Panel Gyroscope

1. Sign out, then open `https://{DOMAIN_NAME}/login` on a desktop width and watch the teal panel for
   the first two seconds without touching anything.
2. Keep watching for two or three minutes without scrolling or moving the pointer.
3. Note where the Rollout IT mark sits, wait about twenty seconds, and look again. Repeat a few times.
4. Maximise the window on the tallest display available and watch another two minutes.
5. Narrow the window from full width down to roughly 1024px, then shorten it to roughly 700px tall and
   then to roughly 640px, watching the mark against the headline, the tip pill, and the footer line the
   whole way.
6. Leave the window at 1024×768 and watch a full minute there.
7. Narrow past the `lg` breakpoint so the panel becomes a banner.
8. Repeat step 1 on `/set-password`, `/reset-password`, and the two-factor challenge screen, in both
   Hungarian and English — the moods with the longest headlines wrap to two lines.
9. Switch the theme between light, dark, and system while the panel is on screen.
10. In the operating system accessibility settings turn on reduce motion, then hard-reload `/login`.

Expected result:

- The rings fade and scale into place one after another over roughly a second, and the mark blooms in
  last. Nothing jumps or lands in the wrong place.
- Four rings turn, at different speeds and in different directions, on three visibly different axes —
  the cage reads as a gyroscope, not as stacked ellipses. Two bright arcs sweep round much faster than
  the rings they ride. Glowing beads travel the rings with short tails behind them, and pass in front
  of and behind the centre. Two faint rings ping outward from the mark every few seconds.
- The whole cage wanders slowly and continuously, carrying the mark with it, and the rings swell and
  shrink as it travels. It moves both across the panel and up and down it, and the two do not keep step:
  the path should never look like a circuit being retraced. Over several minutes the mark should not
  return to a spot you have already seen it in — the two axes only line up again after about 70 minutes.
  The motion is even throughout, easing to a stop only at the far edges of its travel, with no jerk or
  snap anywhere, including where it passes back through the middle.
- The taller the window, the further up and down it ranges; a short window is mostly side to side, and
  around 640px tall it stops moving vertically altogether. That is expected — there is no room.
- The Rollout IT mark stays upright and perfectly still on its frosted tile throughout — it never
  rotates with the rings, and it does not tilt or spin as the cage travels. It breathes very slightly,
  out of step with the glow behind it.
- The mark is the cream version at every width and in every theme, since the panel is teal in both.
- Anywhere the cage wanders, at every window size, the mark's tile never touches or overlaps the
  headline, the tip pill, or the footer line, and never gets clipped by the edge of the teal panel. It
  comes closest to the left and right edges of the panel, so watch those. Ring arcs crossing behind the
  text are expected; the frosted tile landing on text is not.
- On the mobile banner the mark, the two fast arcs, and the innermost ring are gone; the two remaining
  rings are cropped to arcs and still turn.
- Under reduce motion everything is still and the panel still looks composed and deliberate — rings
  crossing on three axes, with the cage at rest at the middle of its travel on both axes: horizontally
  centred on the panel, and vertically midway between the tip pill and the footer line. No ring is
  stranded mid-expansion and nothing is missing except the pings.
- Scrolling and typing in the form on the right stay smooth with the animation running.

### Brand Typefaces Load From The App Itself

Lexend and Poppins are self-hosted from `public/fonts`. Before this they were named in CSS but never
loaded, so every screen silently fell back to the OS UI font. The point of this scenario is to catch
a **silent** regression: on a machine that happens to have Lexend or Poppins installed locally, a
broken `@font-face` still looks correct. Test with DevTools, not with your eyes alone.

1. Open `/dashboard` with DevTools → Network, filtered to **Font**, and hard-reload.
2. Confirm `lexend-variable-latin.woff2` and `lexend-variable-latin-ext.woff2` are both fetched from
   this app's own origin (`/fonts/…`), status 200 — not from `fonts.gstatic.com`.
3. Confirm the two Lexend files start loading immediately on navigation, not after the page paints.
4. Scroll to any table header or uppercase micro-label (`.font-ui`) and confirm `poppins-*.woff2`
   files are fetched too.
5. In DevTools → Elements, select a paragraph of body copy and read the **Computed → Rendered Fonts**
   readout at the bottom of the pane. It must say `Lexend`.
6. Select a table header or a stat-card label and confirm its rendered font is `Poppins`.
7. Switch the app to Hungarian and open a screen with accented copy — `/time` or `/timesheets`.
8. Find a word containing **ő** or **ű** (`Időszak`, `Hétfő`, `Törlés`, `űrlap`) and confirm the
   rendered font for that text is still `Lexend`, with `lexend-variable-latin-ext.woff2` in the
   Network list.
9. Repeat step 8 on a `.font-ui` label containing ő/ű and confirm it is still `Poppins`.
10. Throttle the network to Slow 3G and reload. Watch the first paint of body text.
11. Open `/login` and repeat steps 5 and 8 — the auth screens sit outside the app shell.
12. Repeat steps 5–6 in the other theme.

Expected result:

- Every font file comes from this origin. **No request to `fonts.googleapis.com` or
  `fonts.gstatic.com` on any screen** — the app must render correctly with the machine offline from
  Google, and with Lexend and Poppins uninstalled from the OS.
- Body copy renders as Lexend and `.font-ui` labels render as Poppins, in both themes and both
  locales, on `/login` as well as inside the app shell.
- Hungarian ő and ű are the **same** typeface as the letters around them. A word where ő or ű is
  visibly narrower, differently shaped, or sitting on a different baseline than its neighbours means
  the `latin-ext` file failed to load and the glyph fell back to a system face.
- Nothing renders in a heavier or lighter weight than designed. Poppins only ships 400/500/600/700
  here; a label that looks artificially smeared or squeezed means markup asked for a weight with no
  file behind it.
- Under Slow 3G, text may appear briefly in the fallback face and then swap once — acceptable. Text
  must never be **invisible** while the font loads, and the swap must not reflow the page enough to
  move what you were about to click.

### Brand Dropdowns And Date Pickers

Every native `<select>` and `<input type="date">` in the app is replaced by a brand-aware control,
and dropdowns above eight options grow a search field. The controls submit through hidden native
fields, so the whole point of this scenario is that the **submitted values are unchanged** — a
picker that looks right but sends the wrong shape fails silently, filtering nothing or saving
nothing, with no error on screen.

1. Open `/admin/timesheets`, pick a month in the month picker, and Apply.
2. Read the address bar. It must carry `month=2026-08` — **four digits, a dash, two digits**. A
   `month=2026-08-01` means the filter was dropped: the list will show every month with no error.
3. Confirm the list actually narrowed to that month, then use Clear and confirm the filter resets.
4. On the same page, open the contractor dropdown, type part of an email address, and confirm the
   match is found by email even though the trigger shows only the name.
5. Open `/admin/reports` and click through all five period pills — Month, Week, Day, Year, Custom.
6. Confirm the control beneath them changes shape each time: a month grid, a calendar, a calendar, a
   plain year number field, and a start/end pair.
7. For each period, Apply and confirm the URL carries `anchor=` for the first four and `start=`
   plus `end=` only for Custom. A URL carrying both is wrong.
8. Open `/admin/people` → Invite member. Choose a currency and a timezone by typing in the search
   field rather than scrolling (roughly 300 and 400 options respectively).
9. Send the invite. After the success message, confirm the form is **fully** reset — including the
   currency and timezone triggers, not just the text fields. A trigger still showing the previous
   choice means the next invite will submit an empty value.
10. Open `/admin/rates`, add a rate period, and confirm the currency picker saves. Then open a
    replacement period and confirm days outside the period being replaced are greyed out and
    unclickable.
11. Open `/admin/people` → edit a member → change the timezone. This picker lives inside a drawer:
    confirm the panel opens, the search field takes focus, typing filters, and Enter selects.
12. Open `/time`, open the entry form, and confirm the date picker only offers days inside the open
    week. Confirm the start and end time fields are still the native time inputs, so typing `0930`
    fills them without opening anything.
13. Repeat steps 1, 5 and 12 in Hungarian, then repeat them in the other theme.
14. Repeat step 5 and step 12 at 390px width.
15. Keyboard only, no mouse: tab to a dropdown, open it with Enter, type to filter, arrow to a row,
    Enter to choose, and confirm focus lands back on the trigger. Then open a date picker, arrow
    between days, and press Escape.

Expected result:

- The month filter URL is `YYYY-MM` and the day filters are `YYYY-MM-DD`. Nothing submits a
  partially-padded value such as `2026-8-5`.
- Every "All …" dropdown shows its "All …" label on the trigger when nothing is selected, never a
  blank trigger.
- Search appears on the long lists (currency, timezone, project, member, contractor) and does not
  appear on the short ones (status, role, profile, project type).
- Searching ignores accents in both directions: typing `arvizturo` finds `Árvíztűrő`, and typing
  `Árvíz` finds it too.
- Inside a drawer or dialog the picker panel takes focus and keeps it. Focus snapping back to the
  drawer the instant a panel opens is a failure.
- Every control returns focus to its own trigger when closed, by selection or by Escape.
- Hungarian weekday headers read H / K / Sze / Cs / P / Szo / V and the month caption is lowercase
  (`2026. június`, not `2026. Június`).
- At 390px the calendar and the option lists stay inside the viewport — no horizontal scrolling of
  the page itself.

### Focus Indication

Focus used to paint twice — a global mint outline that no component could cancel, plus each
component's own ring — so dropdowns flashed highlight boxes that came and went for reasons a user
could not see. There are now two treatments and they must never both appear on one control. The
tell-tale of a regression is **two mint rings at different offsets**, or a highlight box that
appears on a mouse click.

1. Open `/admin/timesheets`. Using the mouse only, click the **Status** filter (eight options, a
   plain menu) and read the closed trigger before the panel covers it: no ring, no glow, no outline.
2. With the panel open, move the pointer down the rows. Each row under the pointer gets a soft grey
   fill and nothing else — no ring around the row.
3. Still in that panel, press ↓ three times. This is the case that used to light up: the rows must
   still show only the grey fill.
4. Escape out, then press Tab until the Status trigger has focus. Its border turns mint. Nothing
   else changes — the control must not grow, glow, or gain a second ring outside the border.
5. Click the **Contractor** filter (more than eight options, so it has a search field). The search
   field shows a text caret and **no** box of any kind around it.
6. Type two letters, then hover a result row and arrow through the rows. Only the grey fill moves.
7. Tab through the page chrome — a button, a checkbox, a tab, a table row. Each shows exactly one
   mint indicator. Count the rings: two concentric mint lines is the old bug.
8. Click those same controls with the mouse. Nothing paints — a click leaves no focus box behind.
9. Switch to the light theme and repeat steps 1, 4, 5 and 7. `--ring` is a darker teal there, so a
   too-faint border on the focused trigger is a light-theme-only failure.
10. Open `/time` and click a cell in the week grid. The cell gets a mint stroke drawn **inside** its
    own edges, not spilling over the neighbouring cells.
11. Open a table with clickable rows (`/admin/people`) and Tab to the first and last row. The
    indicator is drawn inside the row and is not clipped by the card edge.
12. Keyboard only, no mouse: Tab from the top of `/admin/timesheets` to the bottom and confirm you
    can always tell where you are. A step where nothing is visibly focused is a blocker, not a nit.

Expected result:

- A control with its own border (inputs, textareas, dropdown and date-picker triggers) indicates
  focus by turning that border mint, and by nothing else.
- A borderless control (button, icon button, chip, tab, calendar day) shows one 2px mint outline
  with a 2px gap. On a filled primary button the gap is what keeps the outline visible — an outline
  flush against the mint fill is a regression.
- Option and menu rows never show an outline or ring in any state, keyboard or pointer.
- Nothing paints on a mouse click anywhere. Hover is the only pointer feedback.
- Table rows and time-grid cells are the only two places using an inset stroke, and both are drawn
  inside their own bounds.
- No focusable element anywhere is left with no visible indicator under keyboard navigation.

## Notification System

### Admin Configuration And Channel Independence

1. Sign in as `{ADMIN_EMAIL}` and open `/settings?section=notifications`.
2. Confirm this section is visible only to admins.
3. Set the company timezone, weekly weekday, and weekly local time, then save.
4. Set the invoice first delay to `72` and repeat interval to `24`, then save.
5. Reload and confirm every value persisted.
6. For one workflow type, enable email and disable in-app delivery. For another type, disable email
   and enable in-app delivery. Save and reload.
7. Trigger both workflows and confirm each uses only its configured channel.
8. Disable both channels for a test notification type and trigger it again.
9. Confirm no email or in-app notification is created for the disabled type.
10. Request a magic link or password reset and confirm authentication email still works even when
    product notification channels are disabled.
11. Open `/admin/audit` and confirm the settings update appears as a localized notification event.

Expected result:

- Schedule fields and every per-type email/in-app switch persist.
- Product channel settings do not disable invitations, magic links, or password recovery.
- Invalid timezone, weekday, time, delay, or repeat values are rejected on the server.

### Notification Bell And Center

1. Trigger a workflow notification for `{CONTRACTOR_EMAIL}` or `{EMPLOYEE_EMAIL}`.
2. Sign in as that member and confirm the bell shows an unread count.
3. Open the bell and confirm at most five recent notifications are shown.
4. Open one notification and confirm it becomes read and navigates to the relevant page.
5. Open `/notifications`, switch between All and Unread, and test pagination when enough records
   exist.
6. Select **Mark all as read** and confirm the unread count disappears.
7. Create more than 15 read notifications, then trigger one more notification.
8. Confirm all unread notifications remain and only the latest 15 read notifications are retained.
9. Repeat the checks in Hungarian and English.

Expected result:

- Titles and bodies use the member's locale at display and email delivery time.
- No notification belonging to another member is visible or markable through the API.
- Read-state changes survive reloads.

### Weekly Missing-Time Reminder

1. Give `{EMPLOYEE_EMAIL}` or `{CONTRACTOR_EMAIL}` an active project assignment for the current
   week, with no time entry and no inactive-week marker.
2. Open the admin dashboard and confirm the member/project pair is flagged.
3. Click **Send reminder** and confirm the member receives the configured email and/or in-app item.
4. Open the notification and confirm it links to the relevant week on `/time`.
5. Confirm `/admin/audit` contains the manual reminder event.
6. Add time for that project, refresh the stale dashboard tab, and try its old reminder button.
7. Repeat with an inactive-week marker instead of a time entry.
8. Confirm both stale attempts are rejected and no notification is created.
9. Remove the time/marker, temporarily configure the weekly schedule a few minutes ahead, and keep
   the application running through the configured time.
10. Confirm exactly one reminder is produced for the scheduled occurrence, even though the
    in-service dispatcher checks every 15 seconds.

Expected result:

- Only active member/project assignments with no time and no inactive marker receive reminders.
- Manual sending revalidates current data instead of trusting a stale dashboard row.
- Repeated dispatcher runs are idempotent for the same weekly occurrence.

### Invoice Reminder Uses Exact Elapsed Hours

1. Approve a contractor timesheet without uploading an invoice.
2. Set the invoice first delay to `1` hour for a practical QA run and repeat interval to `1` hour.
3. Before one elapsed hour, wait for the notification dispatcher and confirm no invoice reminder
   exists.
4. After one exact elapsed hour, confirm the first reminder appears within 15 seconds.
5. Confirm another run within the same occurrence does not duplicate the reminder.
6. After the next elapsed hour, confirm one repeat reminder is created.
7. Upload an invoice and confirm later dispatcher runs stop creating invoice reminders.
8. Restore the intended defaults: first delay `72`, repeat interval `24`.

Expected result:

- Delays use elapsed UTC hours, not weekdays or company-local calendar boundaries.
- The production default starts exactly 72 hours after approval and includes weekends.
- Only approved timesheets still waiting for an invoice are eligible.

### Workflow Notifications And Dispatcher Health

1. Exercise timesheet submit, approve, reject, invoice upload, invoice accept/reject, and paid paths.
2. Upload and replace an employee payslip.
3. Permanently edit a member's time entry from the admin report.
4. For each event, confirm the intended recipient, localized content, channel configuration, and
   action link.
5. Open `/admin/system` and confirm **Notification dispatcher** passes after a successful run.
6. Set `NOTIFICATION_SCHEDULER_DISABLED=true` in a non-production test environment, restart the app,
   wait more than one minute, and confirm the check warns instead of claiming success.
7. Remove that variable, restart the app, and confirm the scheduler recovers without a separate
   Railway service and the System check returns to passing within one minute.
8. Temporarily break SMTP in a non-production test environment and trigger an email notification.
9. Confirm the delivery records a failure and retries with increasing delays, up to five attempts.

Expected result:

- Admins receive review work; members receive decisions and personal document/change events.
- Notification creation is idempotent when the dispatcher scans overlapping event windows.
- The sequential loop does not overlap itself, and the database lock protects multiple replicas.
- Scheduler failures are visible on the System page and email failures remain available for
  operational diagnosis.

## Create Flows In Side Sheets

### Invite Member Sheet

1. Sign in as `{ADMIN_EMAIL}` and open `https://{DOMAIN_NAME}/admin/people`.
2. Confirm the member table's first data row is visible without scrolling.
3. Click `Tag meghívása` / `Invite member` in the page header.
4. Fill in first name, last name and an email that already belongs to a member, then submit.
5. Correct the email to a fresh address, tick `Küldés után újabb meghívó` / `Invite another after
sending`, and submit.
6. Without ticking the checkbox, invite a second fresh address.
7. Reopen the sheet, type a first name, and press `Escape`. Choose `Szerkesztés folytatása` / `Keep
editing`, press `Escape` again, then choose `Elvetés` / `Discard`.
8. Open `https://{DOMAIN_NAME}/admin/people?new=member` directly, then reload that URL.
9. Repeat step 3 below the `sm` breakpoint.

Expected result:

- No invite form is on the page until the sheet is opened.
- The sheet opens over the directory, the URL gains `?new=member`, and focus starts in the first
  field.
- The rejected submit keeps the sheet open, marks the email field, moves focus to it, and **keeps
  every value that was typed**, including the profile, role, currency, timezone and language.
- With `invite another` ticked the sheet stays open, empties, refocuses the first field, and shows
  the confirmation.
- Without it the sheet closes, the directory refreshes with the new row, and the confirmation shows
  above the table.
- `Escape`, the scrim and the close button all ask before discarding typed input; `Keep editing`
  returns to the sheet with the values intact.
- The deep link opens the sheet on load and survives a reload; closing it clears the parameter.
- On a narrow viewport the sheet is full width, the header stays put, the fields scroll, and the
  submit row stays visible.

### Create Project And Project Group Sheets

1. Open `https://{DOMAIN_NAME}/admin/projects` and confirm the project table is visible without
   scrolling.
2. Click `Új projekt` / `New project`, fill in a name, pick a colour, a start date and an end date
   **before** the start date, and submit.
3. Fix the end date and submit.
4. Filter the directory so no project matches, and use the empty state's action.
5. Click `Új csoport` / `New group` next to the `Projektcsoportok` / `Project groups` heading,
   create a group, then edit an existing group from its row's `⋯` menu.
6. Open `https://{DOMAIN_NAME}/admin/projects?new=project` and `?new=group` directly.
7. While the create sheet is dirty, press `Escape`. Choose `Szerkesztés folytatása` / `Keep
editing`, press `Escape` again, then choose `Elvetés` / `Discard`.

Expected result:

- Neither create form is on the page until it is opened.
- The rejected project keeps the sheet open and keeps the name, slug, colour, dates, internal flag
  and notes exactly as entered.
- A successful create closes the sheet, refreshes the directory, and reports above the table.
- The filtered-empty table offers to clear the filters; a genuinely empty one offers to create.
- Both the project and the group forms are side sheets (not modal dialogs), share layout and
  discard-guard behaviour, and the group sheet is the same one for create and edit, titled and
  labelled for the mode it is in.
- Archiving a group reports at the top of the section rather than into the edit form.
- Both deep links open their overlay on load, and the discard guard fires on every dismissal path
  (`Escape`, the scrim, and the close button).

### Project Groups Table And Membership Drawer

1. Open `https://{DOMAIN_NAME}/admin/projects` and scroll to `Projektcsoportok` / `Project groups`.
   Confirm it renders as one table with no card nested inside another.
2. Sort by each column (`Csoport`/`Group`, `Projektek`/`Projects`, `Állapot`/`State`,
   `Frissítve`/`Updated`) and confirm the arrow direction and row order both change.
3. Type into the search field, then set the `Állapot`/`State` and `Projektek`/`Projects` filters.
   Confirm chips appear for each, the `Showing` count tracks, and each chip's `×` removes only that
   filter.
4. Click a group's name to open the membership drawer. Confirm the drawer's segmented control shows
   correct `All`/`Selected`/`Available` counts, and that the counts (and the underlying table row)
   update immediately after each toggle below — no page reload and no separate save step.
5. In the drawer, search for a project by name and by slug (accent-folded — a Hungarian project
   name should match with or without diacritics), switch between the three segments, and confirm
   internal and inactive/archived projects carry their badge.
6. Uncheck a project, confirm a brief pending spinner on that row, then recheck it. Confirm the
   result banner behind the drawer reports both changes and the `/admin/audit` log gains one
   `project_group.project_added`/`.project_removed` entry per toggle.
7. Click `Csoport szerkesztése` / `Edit group` inside the drawer header; confirm it opens the same
   edit sheet as the row menu's `Csoport szerkesztése` / `Edit group` item.
8. From the row's `⋯` menu, open `Projektek kezelése` / `Manage projects` as a second way into the
   same drawer, then archive the group and confirm it drops out of the list.
9. Resize to a phone width and repeat steps 2-4: the table becomes stacked cards, and the drawer's
   segmented control stays on one line instead of wrapping.

Expected result:

- The section is a single bordered table (or, on phones, a single card list) — never a card drawn
  inside another card.
- Sorting, filtering and the `Showing N of M groups` summary all match the visible rows exactly.
- The membership drawer never requires a separate save: every checkbox toggle is applied
  immediately, survives closing and reopening the drawer, and is reflected in both the table's
  project-count cell and the audit log.
- Search matches Hungarian diacritics loosely in both directions (typing `arvizturo` finds
  `árvíztűrő` and vice versa).
- The drawer stays keyboard-reachable: `Tab` reaches the group's name button and the row's `⋯`
  trigger even though the row itself is not a single focus stop.

### Filter Toolbars

Run this on all four admin lists: `/admin/timesheets`, `/admin/payslips`, `/admin/people` and
`/admin/projects`.

1. Open the page and confirm the list is visible without scrolling.
2. Apply two or three filters and submit.
3. Remove one filter by clicking its chip.
4. Use `Törlés` / `Clear`.
5. Type a search term, submit, and read the chip it produces.
6. On `/admin/projects`, filter by a project group.
7. Narrow the window to tablet and phone widths.

Expected result:

- The filters are one toolbar row with no heading, and every control keeps an accessible name for
  screen readers even though the visible labels are gone.
- Each applied filter shows as a chip naming both the filter and its value; removing one chip leaves
  the others applied, and does **not** apply edits sitting unsubmitted in the toolbar.
- `Clear` removes all of them and returns to the unfiltered URL.
- The search chip shows the term next to a magnifier rather than repeating a long field label, and a
  screen reader still hears which filter it is.
- The group chip names the group, never its id.
- On `/admin/people` and `/admin/projects` the `Showing x-y of z` line stays visible even with no
  filters applied; on the other two it lives in the list header as before.
- The payslip employee picker is searchable rather than a native dropdown.
- Check this in **both** locales: the Hungarian labels are markedly longer, and the controls size
  themselves to their content, so a hint such as `Bármely hozzárendelés` is never the thing that
  gets cut off — it takes the width it needs and the row wraps instead.
- Every control on the row is the same height. A long _selected_ value may still ellipsise at the
  control's maximum width; it must never wrap out of its box, and hovering shows the full text.
- On `/admin/projects`, `Tömeges hozzárendelés` / `Bulk assign` sits in the `Projektlista` /
  `Project directory` header on one line, and opening it puts `?new=assignments` in the URL.
- The controls wrap onto further lines on narrow viewports with the submit staying on the right, and
  no page scrolls sideways.

## Regression Checklist For Every Release

- Invitation activation works for a new invited user.
- Magic-link login works for an active user.
- Password setup, password login, and password reset work for active users.
- Unknown email password reset does not reveal account state.
- Company Google login works for configured Workspace users when Google auth is enabled.
- Private or non-company Google accounts are rejected when Google auth is enabled.
- Unknown email login does not reveal account state.
- Signed-out users cannot open protected routes.
- Non-admin users cannot open admin routes.
- Users without passkey or TOTP are redirected to the security setup gate.
- Admin users without TOTP are redirected to the admin TOTP gate.
- Admin people page can invite, resend, edit, deactivate, reactivate, archive, and restore members.
- Admin people page can revoke member sessions.
- Passkey add, login, rename, and remove still work.
- Passkey login skips the `/two-factor` challenge for TOTP-enabled accounts.
- TOTP setup, challenge, invalid-code handling, trusted device, backup-code fallback, and disable
  still work.
- TOTP disablement and backup-code regeneration create audit rows without storing secrets.
- `/dashboard`, `/settings`, `/admin/people`, `/admin/audit`, `/two-factor`, and `/account-status`
  render without layout breakage on desktop and mobile widths.
- The light, dark, and system theme preferences all apply with no flash, survive a reload, and leave
  every screen readable in both themes.
- Body copy renders in Lexend and `.font-ui` labels in Poppins, served from this origin with no
  request to Google, and Hungarian ő/ű match the typeface of the letters beside them.
- No native `<select>` or date input remains on any screen; dropdowns above eight options offer
  search, and searching ignores accents.
- The timesheet month filter submits `YYYY-MM` and actually narrows the list.
- The reports period pills each render their own control shape and submit `anchor` or `start`+`end`,
  never both.
- Currency, timezone, project and member pickers save correctly, and a form reset clears their
  triggers along with the text fields.
- Pickers opened inside a drawer or dialog keep focus, and every control returns focus to its
  trigger on close.
- Focus paints once and only under keyboard navigation: bordered controls brighten their border,
  borderless controls take a single 2px mint outline, option rows show only the pointer tint, and a
  mouse click leaves no highlight box behind.
- Notification settings persist, the dispatcher is fresh, and the bell unread count updates.
- Weekly reminders exclude projects with time or inactive-week markers.
- Invoice reminders use exact elapsed hours and stop after invoice upload.
- Dark mode reads as lit rather than drab: cards sit visibly above the canvas on every screen, the
  primary and CTA buttons each carry a glow of their own temperature, and the active sidebar item
  shows a lit rail plus a tinted row.
- No surface, glow, or chart mark reads as khaki, olive, tan, or drab teal in dark mode.
- The dashboard's danger stat card is rose throughout — tinted surface, sparkline bars, and corner
  glow — with no amber ground under rose content.
- Status pills keep four visibly different tones side by side, each with a border of its own hue,
  and every label stays readable on a card, on a hovered row, and inside a dropdown.
- The atmosphere stays a gutter phenomenon: on the auth screen the description text remains fully
  legible wherever the glows and blobs fall behind it, and no card, table, or panel shows it through.
- Reports charts show six clearly distinct series, and green and rose remain tellable apart when
  viewed through a deuteranopia simulator.
- Light mode reads as a warm printed page rather than a flat white one: a card is clearly a panel
  sitting on the canvas everywhere, including the top-right corner of a page, where a white card
  used to disappear into a white glow.
- Every de-emphasised string is readable in light — table column headers, input placeholders, the
  command-palette placeholder, and inactive sidebar labels. None of them is a pale grey-green.
- No text tier smaller than a heading sits directly on the light canvas: on the auth screen the
  heading and the description are legible wherever the blobs and echo lines fall behind them.
- Warning reads as a real amber in light and its label is legible on a pill, on a card, on a table
  stripe, and on a hovered row — not a mustard on cream.
- Status pills stay four visibly different tones in light, each with a border of its own hue; check
  a warning pill and a danger pill sitting on a beige chip or table stripe specifically.
- The light danger button is legible both at rest and while hovered, and so is a danger row in a
  dropdown menu.
- The light primary button shows a teal gradient rather than a flat fill, and it and the CTA each
  cast a shadow of their own temperature — cool under primary, warm under the CTA.
- Nothing in light reads as a smudge: the active sidebar label and rail, the stat-card sparkline's
  final bar, and the distribution meter bars all have crisp edges with no dark halo behind them.
- The brand atmosphere is present in light — printed pastel blobs with crisp echo lines, the wave,
  the swoosh and the dot lattice — and stays in the gutters, never showing through a card, table or
  panel. It carries no film grain.
- The theme toggle survives a reload in both directions, and switching light↔dark on a dense screen
  changes no layout or geometry, only colour.
- Reports charts stay on white cards in light and show six clearly distinct series there.
- Creating a project, a project group or an invitation happens in an overlay opened from a page
  header; no create form sits above a directory table.
- A rejected create keeps its overlay open with every typed value intact and focus on the offending
  field.
- Closing an overlay with unsaved input asks first, whichever way it is closed.
- Admin list filters read as a single toolbar row with removable chips for whatever is applied.
- A running timer sits in the app header on every signed-in page and at every width, and can be
  stopped from there; starting one happens in an overlay opened from the time-tracking toolbar.
