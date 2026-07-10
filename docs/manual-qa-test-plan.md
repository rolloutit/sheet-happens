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
- `{AUDIT_LOG_VIEW}`: audit-log viewer path, default `https://{DOMAIN_NAME}/admin/audit`.
- `{INVITED_EMAIL}`: email address that owns the tested invitation.
- `{INVITED_FIRST_NAME}`: first name used when creating a new invited member.
- `{INVITED_LAST_NAME}`: last name used when creating a new invited member.
- `{INVITED_PROFILE}`: profile selected for a new invited member, for example contractor or employee.
- `{INVITED_ROLE}`: role selected for a new invited member, for example member or admin.
- `{INVITED_CURRENCY}`: default currency selected for a new invited member.
- `{INVITED_TIMEZONE}`: timezone selected for a new invited member.
- `{INVITED_LOCALE}`: locale selected for a new invited member.
- `{UNKNOWN_EMAIL}`: email address that is not a Sheet Happens member or pending invite.
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
5. Click `Sign in`.

Expected result:

- If 2FA is enabled, the user lands on `https://{DOMAIN_NAME}/two-factor?...`.
- Otherwise, the user lands on `https://{DOMAIN_NAME}/dashboard`.
- Public sign-up is not available from the login screen.

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
9. Create or edit entries so the day total exceeds 24 hours.

Expected result:

- Interval entries save with the correct calculated duration.
- Overlaps show a warning but do not block saving.
- More than 24 hours in one day shows a warning but does not block saving.

### Timer Start And Stop

1. Open `https://{DOMAIN_NAME}/time?week={TIME_TRACKING_WEEK_START}`.
2. Switch to `Day` view.
3. Enter `{TIME_ENTRY_DESCRIPTION}` in the timer description field.
4. Choose `{TIME_TRACKING_PROJECT_A}`.
5. Click `Start`.
6. Confirm the running timer appears in the day view and app header.
7. Stop the timer from the header or day view.

Expected result:

- Only one timer can run for the user.
- The elapsed timer label changes while running without hydration errors.
- Stopping the timer creates a time entry on the timer start date.

### Same As Yesterday Does Not Duplicate Existing Cells

1. Open `https://{DOMAIN_NAME}/time?week={TIME_TRACKING_WEEK_START}`.
2. Create one entry for `{TIME_TRACKING_PROJECT_A}` on a test day.
3. Select the next day.
4. Click `Same as yesterday`.
5. Confirm the copied entry appears on the selected day.
6. Click `Same as yesterday` again for the same selected day.

Expected result:

- The first copy creates entries from the previous day.
- The second copy does not create duplicate entries in project/date cells that already contain time.
- The success message reports skipped entries when applicable.

### Duplicate Last Week Does Not Duplicate Existing Cells

1. Open `https://{DOMAIN_NAME}/time?week={TIME_TRACKING_PREVIOUS_WEEK_START}`.
2. Create entries for `{TIME_TRACKING_PROJECT_A}` and `{TIME_TRACKING_PROJECT_B}`.
3. Open `https://{DOMAIN_NAME}/time?week={TIME_TRACKING_WEEK_START}`.
4. Click `Duplicate last week`.
5. Confirm the previous week's entries appear in the matching days of the current week.
6. Click `Duplicate last week` again.

Expected result:

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
2. Search by project name.
3. Filter by project status.
4. Filter by internal/non-internal project type.
5. Filter by project group.
6. Clear filters.

Expected result:

- The directory updates to match each filter.
- Clearing filters restores the full active directory.
- The layout remains responsive on laptop width.

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
- Admin people page can invite, resend, edit, deactivate, reactivate, and archive members.
- Admin people page can revoke member sessions.
- Passkey add, login, rename, and remove still work.
- TOTP setup, challenge, invalid-code handling, trusted device, backup-code fallback, and disable
  still work.
- TOTP disablement and backup-code regeneration create audit rows without storing secrets.
- `/dashboard`, `/settings`, `/admin/people`, `/admin/audit`, `/two-factor`, and `/account-status`
  render without layout breakage on desktop and mobile widths.
