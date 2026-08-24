export type HelpLocale = "en" | "hu";
export type HelpRole = "ADMIN" | "MEMBER";
export type HelpProfile = "EMPLOYEE" | "CONTRACTOR";

export type ManualTopicAudience = "all" | "employee" | "contractor" | "admin";

export type ManualTopic = {
  id: string;
  audience: ManualTopicAudience;
  title: string;
  summary: string;
  bodyMarkdown: string;
};

export type ManualTopicView = ManualTopic & {
  accessible: boolean;
};

export type DefaultWelcomeInfoPage = {
  title: string;
  bodyMarkdown: string;
};

export type ManualAccessInput = {
  locale: string;
  role: HelpRole;
  profile: HelpProfile;
};

const defaultWelcomeInfoPages: Record<HelpLocale, DefaultWelcomeInfoPage> = {
  en: {
    title: "Welcome to Sheet Happens",
    bodyMarkdown:
      "# Welcome to Sheet Happens\n\n**Sheet Happens** is Rollout IT's internal time tracking and timesheet system. Use it to log work, review monthly contractor timesheets, and keep invoice checks connected to the approved time data.\n\n## First steps\n\n1. Set up your sign-in methods in **Settings**.\n2. Check your available projects in **Time tracking**.\n3. Start logging time against the correct project and date.\n\n## Monthly work\n\nContractors use the monthly **Timesheets** page after tracked time is complete. Employees use the same time tracking source of truth, but do not submit contractor invoices.\n\n## Need help?\n\nUse the **Manual** tab for the exact product behavior. Ask an admin if a project, rate, or access setting looks wrong.",
  },
  hu: {
    title: "Üdv a Sheet Happens-ben",
    bodyMarkdown:
      "# Üdv a Sheet Happens-ben\n\nA **Sheet Happens** a Rollout IT belső időkövető és timesheet rendszere. Itt lehet munkát rögzíteni, havi kontraktori timesheetet ellenőrizni, és a számlaellenőrzést az elfogadott időadatokhoz kötni.\n\n## Első lépések\n\n1. Állítsd be a belépési módokat a **Beállítások** oldalon.\n2. Ellenőrizd az elérhető projektjeidet az **Időkövetés** felületen.\n3. A megfelelő projektre és dátumra kezdd el rögzíteni az időt.\n\n## Havi működés\n\nA kontraktorok a havi **Timesheet** oldalt használják, miután minden idő rögzítve van. Az alkalmazottak ugyanazt az időkövetési adatforrást használják, de nem küldenek be kontraktori számlát.\n\n## Segítség kell?\n\nA pontos termékviselkedést a **Kézikönyv** fül tartalmazza. Kérj admin segítséget, ha egy projekt, óradíj vagy hozzáférési beállítás hibásnak tűnik.",
  },
};

function markdown(strings: TemplateStringsArray, ...values: Array<number | string>) {
  const raw = strings.reduce((result, part, index) => {
    const value = values[index] ?? "";

    return `${result}${part}${value}`;
  }, "");
  const lines = raw
    .replace(/^\n/, "")
    .replace(/\n\s*$/, "")
    .split("\n");
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^ */)?.[0].length ?? 0);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;

  return lines.map((line) => line.slice(Math.min(line.length, minIndent))).join("\n");
}

const manualTopics: Record<HelpLocale, ManualTopic[]> = {
  en: [
    {
      id: "dashboard",
      audience: "all",
      title: "Dashboard",
      summary: "The signed-in landing page for the current member profile.",
      bodyMarkdown: markdown`
        ## Dashboard

        The dashboard is the first page after sign-in. In the current version it stays intentionally minimal, because the operational workflows live in dedicated pages.

        ### What to use it for

        - Confirm that sign-in worked and that the correct member profile is active.
        - Use the available shortcuts to open Time tracking, Settings, People, or Projects.
        - Use the sidebar for the complete product navigation.

        ### If something looks wrong

        - If you see no admin links, your member role is probably Member, not Admin.
        - If you expected Timesheets but do not see it, your current profile is probably Employee, not Contractor.
        - If the page says the account is inactive, archived, or unlinked, ask an admin to check your member profile.
        - If the language is wrong, change it from the header language toggle or Settings.

        ### Who can fix issues

        - Missing role, profile, or member status: admin.
        - Wrong personal language, timezone, or security setup: the user can usually fix it in Settings.
      `,
    },
    {
      id: "my-rates",
      audience: "all",
      title: "My rates",
      summary: "Read-only access to your own central and project-specific rates.",
      bodyMarkdown: markdown`
        ## My rates

        Open **My rates** from the account menu in the top-right corner. This page is read-only and never exposes another member's rate.

        ### Central rate

        - Employees and contractors both see their complete central-rate timeline.
        - The current period is marked explicitly.
        - Future and previous periods remain visible with their date boundaries and currencies.
        - If no central rate is configured, ask an administrator to set it.

        ### Contractor project rates

        - Contractors also see their currently assigned projects.
        - **Project override** means that project's current override replaces the central rate.
        - **Follows the central rate** means there is no current override for that project.
        - Employees do not have project-specific rate overrides.

        ### Troubleshooting

        - Wrong amount or currency: ask an administrator to inspect the relevant rate period.
        - Missing project: ask an administrator to check the project assignment and its validity dates.
        - Missing current rate: an administrator must add a central rate or a current project override.
      `,
    },
    {
      id: "time-tracking",
      audience: "all",
      title: "Time tracking",
      summary: "Daily and weekly time entry for employees and contractors.",
      bodyMarkdown: markdown`
        ## Time tracking

        Time tracking is for everyone: employees and contractors. Timesheets and invoices are contractor-only, but raw time entries are shared and become the source of truth for reports.

        ### Basic rules

        - Every entry must have a project assignment.
        - Every entry must have a work date and a positive duration.
        - Descriptions are required when an entry is stored as a detailed entry.
        - Users can edit open periods only.
        - Submitted contractor months are locked until an admin rejects or unlocks the workflow.
        - Work dates follow the member timezone.

        ### Weekly grid

        - Use the project-by-day grid for fast daily entry.
        - Type a duration directly into a cell.
        - Empty cells open the detailed entry form because a description is required.
        - If you stop typing for a moment, the detailed editor opens automatically so the description can be added.
        - Click a populated day to review the entries behind the daily total.

        ### Accepted duration formats

        - Decimal hours, for example \`3.5\`.
        - Hour and minute notation, for example \`3:30\`.
        - Text format, for example \`3h 20m\`.
        - Minute-only format, for example \`200m\`.

        ### Detailed entry form

        - Use New entry when you need an explicit description, project, date, interval, or duration.
        - Duration mode stores a duration directly.
        - Interval mode calculates duration from start and end time.
        - End time must be after start time.
        - Changing the project or date can fail if the assignment is no longer valid.

        ### Timer

        - Start the timer for an assigned project and description.
        - Stop the timer when the work is done.
        - Stopping creates a normal time entry.
        - If the project becomes unavailable while the timer runs, stopping can fail and the error explains what needs admin attention.

        ### Quick actions

        - Same as yesterday copies yesterday's entries into the selected day.
        - Duplicate last week copies entries from the previous week.
        - Both actions show a confirmation before changing data.
        - Review the target week carefully before confirming.

        ### Warnings and hard limits

        - More than 8 hours on one day is allowed but shown as a warning.
        - More than 24 hours on one day is blocked.
        - Future dates and overlapping entries are warning-level situations unless another validation rule blocks the save.
        - Locked periods cannot be changed by the user.

        ### Troubleshooting

        - Project missing from the grid: ask an admin to check project assignment dates and project status.
        - Save says the project is not active: the project, assignment, or date range changed; ask an admin to correct it.
        - The day total is over 8 hours: review the entries and keep it only if it is intentional.
        - The day total would exceed 24 hours: reduce or split entries; the app will not save impossible totals.
        - Locked period: the related contractor timesheet has been submitted or approved; ask an admin if a correction is needed.
      `,
    },
    {
      id: "contractor-timesheets",
      audience: "contractor",
      title: "Contractor timesheets and invoices",
      summary: "Monthly contractor submission, invoice upload, correction, and payment status.",
      bodyMarkdown: markdown`
        ## Contractor timesheets and invoices

        Contractor timesheets are monthly previews generated from raw time entries. The timesheet is not a separate manual spreadsheet; it is a snapshot of the tracked month at the moment of submission.

        ### Before submitting

        - Choose the correct month.
        - Check project totals and entry counts.
        - Confirm every project has a resolved rate.
        - Confirm the month has a single currency.
        - Fix raw time entries before submitting.

        ### Submit flow

        - Click Submit timesheet when the month is complete.
        - The app validates contractor profile, open period, required entry data, rates, and currency.
        - Submission creates or updates the timesheet.
        - A new immutable revision and snapshot lines are created.
        - The source time entries are locked to that revision.

        ### Status meaning

        - Not submitted: the month is still editable.
        - Submitted: waiting for admin review.
        - Rejected: the admin found an issue; correct raw time and resubmit.
        - Approved: the time and amount are accepted; invoice upload can start.
        - Invoiced: an invoice PDF was uploaded and is waiting for invoice review.
        - Invoice rejected: the invoice is wrong and needs cancellation/replacement handling.
        - Accepted: the invoice has been accepted.
        - Paid: finance/payment is complete.

        ### Invoice upload

        - Upload the invoice only after timesheet approval.
        - Enter invoice metadata, including invoice number, amount, issue date, and currency.
        - Review the rendered PDF preview before submitting the invoice step.
        - The metadata is helpful, but the PDF remains the legal document.

        ### Cancellation and correction

        - If an invoice is rejected because it was issued incorrectly, do not simply replace it.
        - Upload the cancellation invoice with the negative amount of the rejected invoice.
        - After the cancellation invoice is stored, upload the corrected replacement invoice.
        - If the underlying time is wrong, the admin should reject the timesheet revision so raw time can be corrected and resubmitted.

        ### Troubleshooting

        - Missing rate: ask an admin to add the central rate or project override.
        - Mixed currency: ask an admin to correct the rate periods so the selected month resolves to one currency.
        - Submit button disabled: review warnings near the monthly summary; rate or currency setup is usually missing.
        - Cannot edit time entries: the month is locked by a submitted or approved timesheet.
        - Invoice amount rejected: compare invoice metadata and PDF totals with the approved timesheet amount.
      `,
    },
    {
      id: "employee-payslips",
      audience: "employee",
      title: "Employee payslips",
      summary: "Private monthly payslip access for employee profiles.",
      bodyMarkdown: markdown`
        ## Employee payslips

        Payslips are private monthly PDF documents for employee profiles. They are separate from contractor timesheets and invoices.

        ### View and download

        - Open **Payslips** from the sidebar.
        - The latest available document is shown first; earlier months remain available below it.
        - Use Preview to inspect the PDF in the app, or Download to save it.
        - Every view and download uses a short-lived private link. Do not share the resulting browser URL.

        ### Access rules

        - You can view only your own payslips.
        - The page is read-only. You cannot upload, replace, or delete a payslip.
        - Contractor profiles do not have this feature because contractor billing uses the Timesheets workflow instead.

        ### Troubleshooting

        - No payslip for a month: ask payroll or an admin to upload it.
        - Preview or download fails: refresh once, then ask an admin to check object storage and the audit log.
        - The document looks incorrect: do not edit it locally; ask an admin to replace the published PDF.
      `,
    },
    {
      id: "settings",
      audience: "all",
      title: "Security settings",
      summary: "Passkeys, authenticator-app verification, backup codes, and profile settings.",
      bodyMarkdown: markdown`
        ## Security settings

        Settings contains account security and personal preferences. Keep this page up to date before relying on the app for daily work.

        ### Sign-in methods

        - Magic-link email sign-in is available for activated accounts.
        - Password sign-in is available after password setup.
        - Passkeys are recommended for fast device-based sign-in.
        - Company Google sign-in is available only when the environment is configured for the company domain.

        ### Passkeys

        - Add a passkey from Settings on a trusted device.
        - Use passkey login from the login screen.
        - Rename passkeys so old devices are easy to identify.
        - Remove only passkeys you no longer need.

        ### Authenticator app and backup codes

        - Authenticator-app setup is required for admin accounts.
        - Password, magic-link, and Google sign-in can require a TOTP challenge.
        - Passkey sign-in satisfies the sign-in challenge without an extra TOTP code.
        - Scan the QR code during setup.
        - Save backup codes when they are generated.
        - Backup codes are one-time recovery codes; do not reuse them.
        - Admin management screens require authenticator-app setup, even when passkey sign-in is used.

        ### Personal preferences

        - Locale controls the app language where translated text exists.
        - Timezone controls local work dates and day boundaries.
        - Time display controls whether durations appear as decimal hours or exact hours and minutes. This changes presentation only; stored minutes and calculated amounts do not change.
        - Currency is used as the member default for billing and reporting setup.

        ### Troubleshooting

        - Lost authenticator app and backup codes: ask an admin to reset your TOTP setup.
        - Passkey login does not work: try another sign-in method, then check or remove the passkey in Settings.
        - Magic link opens but no member profile is linked: sign in with the email that was activated from the invitation.
        - Admin tools still blocked: set up authenticator-app verification first, then passkey sign-in can skip the code prompt.
      `,
    },
    {
      id: "people",
      audience: "admin",
      title: "People and access",
      summary: "Invitations, member state, role changes, profile changes, and recovery actions.",
      bodyMarkdown: markdown`
        ## People and access

        People is the admin view for member profiles. A member profile is the business record used by Sheet Happens. Better Auth users are linked to member profiles after invitation activation.

        ### Finding people

        - Use quick search for name or email.
        - Filter by state, role, and profile.
        - Use pagination for larger directories.
        - Clear filters before assuming a member is missing.

        ### Invite flow

        - Create an invited member with name, email, profile, role, currency, timezone, and locale.
        - The default invitation link is valid for 72 hours.
        - The invited user must open the invitation and sign in with the same email.
        - Activation links the auth user to the member profile.
        - Duplicate invitations for the same email are blocked.

        ### Member states

        - Invited: profile exists but the invitation has not been activated.
        - Active: user can sign in and use allowed features.
        - Inactive: access is disabled without archiving the profile.
        - Archived: profile is hidden from normal active workflows but can be reactivated if the same person needs access again.

        ### Common admin actions

        - Resend invitation when an invited user did not activate within 72 hours.
        - Reactivate an archived member when the same person returns.
        - Change role between Member and Admin.
        - Schedule profile changes between Employee and Contractor.
        - Revoke sessions when access should be refreshed immediately.
        - Reset TOTP when the user lost authenticator access and backup codes.

        ### Troubleshooting

        - User says invitation expired: resend the invitation from People.
        - User was archived but needs access again: reactivate the member, then verify role/profile and project assignments.
        - User logs in but sees no linked profile: confirm the auth email matches the member email and the invitation was activated.
        - User cannot access admin pages: confirm role is Admin and TOTP is set up.
        - Profile transition seems missing: check scheduled transition date and audit rows.
      `,
    },
    {
      id: "admin-payslips",
      audience: "admin",
      title: "Admin payslip management",
      summary: "Monthly employee PDF upload, replacement, deletion, and access auditing.",
      bodyMarkdown: markdown`
        ## Admin payslip management

        Payslips are private employee documents. They are not calculated from time entries and are independent from contractor timesheets and invoices.

        ### Upload a monthly payslip

        - Open **Payslips** in the Admin navigation.
        - Select an employee profile and the payroll month.
        - Upload a PDF no larger than 10 MB.
        - The month overview lists active employees still missing a document; click a name to prefill an upload.
        - One current payslip exists for each employee and month.

        ### Replace or delete

        - Use Replace on an existing row when payroll provides a corrected PDF.
        - The replacement becomes the current document for that employee/month; the old document is removed from private storage.
        - Use Delete only when the current document must be withdrawn. The month can then be uploaded again.
        - Upload, replacement, deletion, preview, and download are recorded in the audit log.

        ### Find records and investigate issues

        - Search by employee name or email and filter by employee or month.
        - Use pagination for older records; filters run on the server.
        - An inactive employee can remain in historical records, but the monthly missing overview is based on active employees.
        - If upload fails, check the System page for object-storage health and configuration.
      `,
    },
    {
      id: "projects",
      audience: "admin",
      title: "Projects and assignments",
      summary:
        "Project lifecycle, project groups, member assignment, bulk assignment, and color labels.",
      bodyMarkdown: markdown`
        ## Projects and assignments

        Projects control where users can log time. A user cannot create projectless time entries, so project setup must be correct before work starts.

        ### Projects

        - Create projects with a clear name and slug.
        - Use status to control whether a project is available.
        - Use archive for projects that should leave normal active workflows.
        - Use project colors as visual identifiers in the time grid, timesheets, and reports.

        ### Project groups

        - Groups are organizational helpers.
        - Groups help filtering and navigation.
        - Groups do not change billing, reporting semantics, or access rules by themselves.

        ### Assignments

        - Assign active or invited members to projects.
        - Assignment start and end dates control logging eligibility.
        - A member can log only inside the project and assignment validity windows.
        - Bulk assignment is useful when multiple people need the same project access.

        ### Search and filters

        - Search by project name or slug.
        - Filter by project state, group, and assignment-related criteria.
        - Project groups have their own search/filter controls.
        - Clear filters before creating duplicate setup.

        ### Troubleshooting

        - Project does not appear in Time tracking: check project state and assignment dates.
        - User cannot save on a specific day: check whether that date is inside the project and assignment validity range.
        - Color indicator looks wrong: update the project color and refresh affected views.
        - Duplicate assignment errors: check existing assignments and adjust dates instead of creating overlapping records.
      `,
    },
    {
      id: "rates",
      audience: "admin",
      title: "Rates and overrides",
      summary: "Central rates, project-specific overrides, future periods, and overlap handling.",
      bodyMarkdown: markdown`
        ## Rates and overrides

        Rates resolve the monetary value of tracked time for timesheets and internal reporting. Incorrect rates can block submission or create mixed-currency months.

        ### Central rates

        - A central rate belongs to a member and date period.
        - Employees and contractors can both have internal rates.
        - If no project override exists, the central rate is used.
        - Open-ended rates apply until replaced or closed.

        ### Project overrides

        - Contractor project overrides can differ from the central rate.
        - Overrides apply only to the selected project.
        - Other projects continue to use the central rate.
        - Overrides are useful when a contractor has a special project-specific billing rate.

        ### Currency rules

        - A submitted month must resolve to a single currency.
        - Currency changes must start on the first day of a future month.
        - If today is the first day of the month, the new currency may start today.
        - Mixed-currency months must be fixed by changing open rate periods, not by contractor action.

        ### Period changes

        - Overlapping rate periods are blocked.
        - If a rate crosses closed months, preserve the closed part.
        - Split or replace only the open part when a future correction is needed.
        - Historical timesheet snapshots must remain stable.

        ### Troubleshooting

        - Timesheet says missing rate: add a central rate or project override covering the entry date.
        - Timesheet says mixed currency: inspect central and project override rates for the selected month.
        - Cannot add a new future rate because an open-ended one overlaps: split or replace the open-ended period first.
        - Replacement start date error: use split/replacement only where the existing period can be shortened safely, or edit an unsubmitted period directly when allowed.
      `,
    },
    {
      id: "admin-timesheets",
      audience: "admin",
      title: "Admin timesheet review",
      summary:
        "Review, reject, approve, invoice-check, cancellation invoice, and paid status flow.",
      bodyMarkdown: markdown`
        ## Admin timesheet review

        Admin review is separate from raw time tracking. The contractor submits a monthly revision; admins review the immutable snapshot and then handle invoice checks.

        ### Review submitted timesheet

        - Open Admin / Approvals.
        - Filter or search for submitted contractor timesheets.
        - Open the submitted month.
        - Compare project totals, hours, rates, currency, and amount.
        - Use audit/history data when a correction looks suspicious.

        ### Approve or reject

        - Approve when the submitted revision is correct.
        - Reject when raw time, project assignment, rate, or currency setup needs correction.
        - Rejection should include a reason the contractor can act on.
        - After rejection, the contractor corrects raw time and resubmits a new revision.

        ### Invoice review

        - After approval, the contractor uploads an invoice PDF.
        - Compare the rendered PDF against approved totals and invoice metadata.
        - Accept only if the invoice is correct.
        - If the invoice was issued incorrectly, request the cancellation invoice first.
        - After cancellation is uploaded, accept a corrected replacement invoice.
        - Mark as paid only after the finance/payment step is complete.

        ### Troubleshooting

        - Contractor cannot submit because of missing rates: fix rates before asking them to retry.
        - Contractor cannot submit because of mixed currency: correct rate periods for that month.
        - Contractor needs to edit a submitted month: reject the timesheet so the locked entries can be corrected.
        - Invoice preview is unavailable: check object storage and file metadata.
        - PDF export/rendering fails elsewhere: check the System page for Typst availability.
      `,
    },
    {
      id: "reports",
      audience: "admin",
      title: "Reports and PDF exports",
      summary:
        "Server-side filters, grouped reporting, cost-free exports, and Typst PDF generation.",
      bodyMarkdown: markdown`
        ## Reports and exports

        Reports are generated from raw time entries. Timesheet snapshots matter for contractor billing, but reporting starts from the tracked work data.

        ### Filtering

        - Use date range filters to select the reporting period.
        - Filter by member, project, and project group.
        - Use server-side filtering for large datasets.
        - Review active filters before exporting.

        ### Report views

        - Member-focused views help compare people and tracked totals.
        - Project-focused views help compare delivery and project load.
        - Group filters help summarize related projects.
        - Missing rates should stay visible as missing, not silently become zero.

        ### Exports

        - Cost-free exports hide hourly rates and calculated amounts.
        - Internal exports include rates and amounts and should be shared carefully.
        - PDF export uses Typst in the application runtime.
        - CSV or tabular exports should be checked for the same filters used on screen.

        ### Troubleshooting

        - Export is empty: check date range, member, project, and group filters.
        - Amounts are missing: check rates for the selected period.
        - PDF export fails: ask an admin to check the System page for Typst and object storage.
        - Numbers differ from a submitted timesheet: reports use raw entries while timesheets use submitted snapshots.
      `,
    },
    {
      id: "audit-system",
      audience: "admin",
      title: "Audit log and system checks",
      summary: "Operational visibility for admin actions and deployment configuration.",
      bodyMarkdown: markdown`
        ## Audit log and system checks

        Audit and system pages help admins understand what happened and whether the environment is configured correctly.

        ### Audit log

        - Audit rows record important admin and workflow actions.
        - Search by action, target type, actor, and date range.
        - Open details to compare before and after values.
        - Sensitive-looking fields are redacted in the UI.
        - Use audit rows when investigating role changes, rate changes, TOTP resets, timesheet status changes, invoice actions, and report exports.

        ### System checks

        - Use System after deployment or environment-variable changes.
        - Check application URLs and auth configuration.
        - Check database access.
        - Check object storage before invoice upload.
        - Check email delivery before invitation or magic-link testing.
        - Check Google OAuth when company Google sign-in is expected.
        - Check Typst before report PDF export.

        ### Troubleshooting

        - OAuth login fails after redirect: verify public URL variables and Google redirect URI.
        - Magic links do not arrive: check SMTP configuration or console delivery mode.
        - Invoice upload fails: check object storage credentials and bucket access.
        - PDF export fails: check whether Typst is present in the deployed runtime.
        - Audit event missing: confirm the action actually completed and that filters are not hiding it.
      `,
    },
    {
      id: "info-page",
      audience: "admin",
      title: "Help welcome content",
      summary: "Admin-maintained markdown shown in the Help / Welcome tab.",
      bodyMarkdown: markdown`
        ## Help welcome content

        Help has two content sources. The Welcome tab is admin-maintained in the app. The Manual tab is maintained in source code and should be treated as the exact product reference.

        ### Welcome tab

        - Use Welcome for casual onboarding notes.
        - Add team-specific contacts, temporary announcements, or environment-specific guidance.
        - Keep it short enough for new users to scan.
        - Publishing creates an immutable version and audit row.

        ### Manual tab

        - The Manual tab is source-controlled.
        - It should be updated together with feature changes.
        - Non-admin users see restricted topic names but not restricted operational details.
        - Admin-only details should stay in admin topics.

        ### Supported Markdown

        - Headings.
        - Bold and italic text.
        - Ordered and unordered lists.
        - Quotes.
        - Links.
        - Inline code.
        - Raw HTML is not rendered.

        ### Troubleshooting

        - Published content does not appear: refresh Help and confirm the publish action succeeded.
        - Formatting looks wrong: check that the content uses the supported Markdown subset.
        - A manual topic is outdated: update the source-controlled manual content and deploy.
        - A restricted user sees too much detail: check the topic audience and access rules.
      `,
    },
  ],
  hu: [
    {
      id: "dashboard",
      audience: "all",
      title: "Irányítópult",
      summary: "A bejelentkezés utáni kezdőoldal az aktuális tagprofilhoz.",
      bodyMarkdown: markdown`
        ## Irányítópult

        Az irányítópult a bejelentkezés utáni kezdőoldal. A jelenlegi verzióban szándékosan egyszerű, mert a tényleges munkafolyamatok külön oldalakon vannak.

        ### Mire használd

        - Ellenőrizd, hogy sikeres volt a bejelentkezés, és a megfelelő tagprofil aktív.
        - Használd a gyorslinkeket az Időkövetés, Beállítások, Emberek vagy Projektek megnyitásához.
        - A teljes navigációhoz használd az oldalsávot.

        ### Ha valami nem stimmel

        - Ha nem látsz admin linkeket, valószínűleg Tag szerepköröd van, nem Admin.
        - Ha Timesheetet vártál, de nem látod, valószínűleg Alkalmazott profilod van, nem Kontraktor.
        - Ha az oldal inaktív, archivált vagy nem kapcsolt fiókot jelez, kérj admin ellenőrzést.
        - Ha rossz a nyelv, váltsd át a fejlécben vagy a Beállításokban.

        ### Ki tudja javítani

        - Hiányzó szerepkör, profil vagy tagállapot: admin.
        - Saját nyelv, időzóna vagy biztonsági beállítás: általában a felhasználó a Beállításokban.
      `,
    },
    {
      id: "my-rates",
      audience: "all",
      title: "Saját óradíjaim",
      summary: "Csak olvasható hozzáférés a saját központi és projektspecifikus óradíjakhoz.",
      bodyMarkdown: markdown`
        ## Saját óradíjaim

        A jobb felső sarokban lévő fiókmenüből nyisd meg a **Saját óradíjaim** oldalt. Az oldal csak olvasható, és soha nem mutatja más tag óradíját.

        ### Központi óradíj

        - Az alkalmazottak és a kontraktorok is látják a központi óradíjuk teljes idővonalát.
        - A jelenlegi időszak külön jelölést kap.
        - A jövőbeli és korábbi időszakok a dátumhatárokkal és pénznemmel együtt láthatók maradnak.
        - Ha nincs központi óradíj, kérd meg az admint a beállítására.

        ### Kontraktori projektóradíjak

        - A kontraktorok az aktuálisan hozzájuk rendelt projekteket is látják.
        - A **Projektfelülírás** azt jelenti, hogy az adott projekt jelenlegi felülírása helyettesíti a központi óradíjat.
        - **A központi óradíjat követi** azt jelenti, hogy a projekthez nincs jelenlegi felülírás.
        - Az alkalmazottaknak nincs projektspecifikus óradíj-felülírásuk.

        ### Hibaelhárítás

        - Hibás összeg vagy pénznem: kérd meg az admint a vonatkozó óradíjidőszak ellenőrzésére.
        - Hiányzó projekt: kérd meg az admint a projekthozzárendelés és az érvényességi dátumok ellenőrzésére.
        - Hiányzó jelenlegi óradíj: az adminnak központi óradíjat vagy jelenlegi projektfelülírást kell beállítania.
      `,
    },
    {
      id: "time-tracking",
      audience: "all",
      title: "Időkövetés",
      summary: "Napi és heti időrögzítés alkalmazottaknak és kontraktoroknak.",
      bodyMarkdown: markdown`
        ## Időkövetés

        Az időkövetés mindenkié: alkalmazottaké és kontraktoroké is. A timesheet és a számla kontraktori folyamat, de a nyers időbejegyzés közös adatforrás a riportokhoz.

        ### Alapszabályok

        - Minden bejegyzéshez kötelező egy hozzárendelt projekt.
        - Minden bejegyzéshez kell munkadátum és pozitív időtartam.
        - Részletes bejegyzésnél a leírás kötelező.
        - A felhasználó csak nyitott időszakot módosíthat.
        - Beküldött kontraktori hónap zárolódik, amíg admin nem utasítja el vagy nem nyitja újra a folyamatot.
        - A munkadátum a tag időzónája szerint értendő.

        ### Heti rács

        - A projekt-nap rács gyors napi rögzítésre való.
        - Írj időtartamot közvetlenül a cellába.
        - Az üres cella a részletes űrlapot nyitja meg, mert leírás is kell.
        - Ha megállsz gépelés közben, a részletes szerkesztő automatikusan megjelenik.
        - Kattints egy kitöltött napra a napi összeg mögötti bejegyzések ellenőrzéséhez.

        ### Elfogadott időformátumok

        - Decimális óra, például \`3.5\`.
        - Óra-perc jelölés, például \`3:30\`.
        - Szöveges formátum, például \`3h 20m\`.
        - Csak perc, például \`200m\`.

        ### Részletes bejegyzés

        - Az Új bejegyzés akkor hasznos, ha pontos leírást, projektet, dátumot, intervallumot vagy időtartamot adsz meg.
        - Időtartam módban közvetlenül időtartam mentődik.
        - Intervallum módban a rendszer a kezdő és záró időből számol.
        - A záró időnek későbbinek kell lennie a kezdő időnél.
        - Projekt vagy dátum módosításakor a mentés elbukhat, ha a hozzárendelés már nem érvényes.

        ### Időmérő

        - Indítsd el az időmérőt egy hozzárendelt projektre és leírásra.
        - Állítsd le, amikor kész a munka.
        - Leállításkor normál időbejegyzés jön létre.
        - Ha a projekt futás közben elérhetetlenné válik, a leállítás hibára futhat, és az üzenet jelzi, miben kell admin segítség.

        ### Gyors műveletek

        - A Tegnappal megegyező a tegnapi bejegyzéseket másolja a kiválasztott napra.
        - Az Előző hét duplikálása az előző hét bejegyzéseit másolja.
        - Mindkét művelet megerősítést kér.
        - Jóváhagyás előtt ellenőrizd a célhetet.

        ### Figyelmeztetések és kemény limitek

        - Napi 8 óra felett a mentés engedett, de figyelmeztetés jelenik meg.
        - Napi 24 óra felett a mentés blokkolt.
        - Jövőbeli dátum és átfedő bejegyzés figyelmeztetés, amíg más szabály nem blokkolja a mentést.
        - Zárolt időszakot a felhasználó nem módosíthat.

        ### Hibaelhárítás

        - Hiányzik a projekt a rácsból: kérj admin ellenőrzést a projekt státuszára és hozzárendelési dátumaira.
        - A mentés szerint a projekt nem aktív: a projekt, a hozzárendelés vagy a dátumtartomány változott; admin javítás kell.
        - A napi összeg 8 óra felett van: ellenőrizd a bejegyzéseket, és csak szándékos esetben hagyd így.
        - A napi összeg 24 óra fölé menne: csökkentsd vagy bontsd a bejegyzéseket; lehetetlen összeg nem menthető.
        - Zárolt időszak: kapcsolódó timesheet már be lett küldve vagy jóvá lett hagyva; javításhoz admin elutasítás kell.
      `,
    },
    {
      id: "contractor-timesheets",
      audience: "contractor",
      title: "Kontraktori timesheetek és számlák",
      summary: "Havi beküldés, számlafeltöltés, korrekció és kifizetési státusz.",
      bodyMarkdown: markdown`
        ## Kontraktori timesheetek és számlák

        A kontraktori timesheet havi előnézet a nyers időbejegyzésekből. Nem külön kézzel vezetett táblázat, hanem a rögzített hónap snapshotja a beküldés pillanatában.

        ### Beküldés előtt

        - Válaszd ki a megfelelő hónapot.
        - Ellenőrizd a projektek összesített óráit és a bejegyzésszámokat.
        - Győződj meg róla, hogy minden projekthez feloldható óradíj tartozik.
        - Győződj meg róla, hogy a hónap egy pénznemre számolódik.
        - A nyers időbejegyzéseket beküldés előtt javítsd.

        ### Beküldési folyamat

        - Akkor kattints a Timesheet beküldése gombra, ha a hónap kész.
        - A rendszer ellenőrzi a kontraktori profilt, a nyitott időszakot, a kötelező adatokat, az óradíjakat és a pénznemet.
        - Beküldéskor létrejön vagy frissül a timesheet.
        - Új változtathatatlan revízió és snapshot sorok jönnek létre.
        - A forrás időbejegyzések a revízióhoz zárolódnak.

        ### Státuszok jelentése

        - Nincs beküldve: a hónap még szerkeszthető.
        - Beküldve: admin ellenőrzésre vár.
        - Elutasítva: admin hibát talált; javítsd a nyers időt és küldd be újra.
        - Jóváhagyva: az idő és összeg elfogadva; indulhat a számlafeltöltés.
        - Számlázva: PDF számla feltöltve, számlaellenőrzésre vár.
        - Számla elutasítva: a számla hibás, sztornó és csere folyamat szükséges.
        - Elfogadva: a számla elfogadva.
        - Kifizetve: a pénzügyi/kifizetési lépés lezárult.

        ### Számlafeltöltés

        - Számlát csak jóváhagyott timesheet után tölts fel.
        - Add meg a számla metaadatait, például számlaszámot, összeget, kiállítási dátumot és pénznemet.
        - Beküldés előtt ellenőrizd a renderelt PDF előnézetet.
        - A metadata hasznos, de a PDF marad a jogi dokumentum.

        ### Sztornó és javítás

        - Hibásan kiállított számlát nem elég egyszerűen lecserélni.
        - Előbb fel kell tölteni a hibás számla negatív összegű sztornó számláját.
        - A sztornó után tölthető fel a javított csere számla.
        - Ha az alapul szolgáló idő hibás, az admin utasítsa el a timesheet revíziót, hogy a nyers idő javítható és újra beküldhető legyen.

        ### Hibaelhárítás

        - Hiányzó óradíj: kérj admintól központi díjat vagy projektfelülírást.
        - Vegyes pénznem: kérj admintól óradíj-időszak javítást, hogy a hónap egy pénznemre számolódjon.
        - Beküldés gomb tiltott: nézd meg a havi összegzés melletti figyelmeztetést; általában díj vagy pénznem hiányzik.
        - Nem tudod szerkeszteni az időt: a hónap beküldött vagy jóváhagyott timesheet miatt zárolt.
        - Számlaösszeg elutasítva: hasonlítsd össze a számla metaadatait és PDF összegét a jóváhagyott timesheettel.
      `,
    },
    {
      id: "employee-payslips",
      audience: "employee",
      title: "Alkalmazotti bérjegyzékek",
      summary: "Privát havi bérjegyzék-elérés alkalmazotti profilhoz.",
      bodyMarkdown: markdown`
        ## Alkalmazotti bérjegyzékek

        A bérjegyzék alkalmazotti profilhoz tartozó privát havi PDF dokumentum. Nem része a kontraktori timesheet- és számlafolyamatnak.

        ### Megtekintés és letöltés

        - Nyisd meg a **Bérjegyzékek** oldalt az oldalsávból.
        - A legfrissebb elérhető dokumentum látszik először, alatta a korábbi hónapok.
        - Az Előnézettel az appban nézheted meg a PDF-et, a Letöltéssel mentheted le.
        - Minden megtekintés és letöltés rövid élettartamú privát linket használ. A megnyíló böngésző URL-t ne oszd meg.

        ### Hozzáférési szabályok

        - Csak a saját bérjegyzékeidet tekintheted meg.
        - Az oldal csak olvasható. Nem tölthetsz fel, cserélhetsz vagy törölhetsz bérjegyzéket.
        - Kontraktori profilnál ez a funkció nem érhető el, mert a kontraktori elszámolás a Timesheet folyamatban történik.

        ### Hibaelhárítás

        - Hiányzik egy havi bérjegyzék: kérd a payroll vagy az admin segítségét a feltöltéshez.
        - Nem működik az előnézet vagy letöltés: egyszer frissíts, majd kérd az admint az objektumtár és audit napló ellenőrzésére.
        - Hibásnak tűnik a dokumentum: ne szerkeszd helyben; kérd az admint a közzétett PDF cseréjére.
      `,
    },
    {
      id: "settings",
      audience: "all",
      title: "Biztonsági beállítások",
      summary: "Passkey, authenticator-app ellenőrzés, tartalék kódok és profilbeállítások.",
      bodyMarkdown: markdown`
        ## Biztonsági beállítások

        A Beállítások oldalon találhatók a fiókbiztonsági és személyes preferencia beállítások. Ezeket érdemes rendben tartani a napi használat előtt.

        ### Belépési módok

        - A mágikus email link aktivált fiókoknál használható.
        - Jelszavas belépés jelszóbeállítás után használható.
        - A passkey ajánlott gyors, eszközalapú bejelentkezéshez.
        - Céges Google belépés csak akkor elérhető, ha a környezet a céges domainre konfigurált.

        ### Passkey

        - Megbízható eszközön add hozzá a passkey-t a Beállításokban.
        - A belépési oldalon válaszd a passkey belépést.
        - Nevezd át a passkey-ket, hogy a régi eszközök felismerhetők legyenek.
        - Csak olyan passkey-t törölj, amire már nincs szükség.

        ### Authenticator app és tartalék kódok

        - Admin fiókoknál kötelező az authenticator alkalmazás beállítása.
        - Jelszavas, mágikus linkes és Google belépésnél szükség lehet TOTP ellenőrzésre.
        - A passkey belépés külön TOTP kód nélkül teljesíti a belépési ellenőrzést.
        - Beállításkor olvasd be a QR kódot.
        - A generált tartalék kódokat mentsd el.
        - A tartalék kódok egyszer használatos helyreállítási kódok.
        - Az admin kezelőfelületekhez authenticator-app beállítás szükséges akkor is, ha passkey-vel lépsz be.

        ### Személyes preferenciák

        - A nyelv az app lefordított szövegeit szabályozza.
        - Az időzóna határozza meg a helyi munkadátumot és napváltást.
        - Az időtartam-megjelenítésnél tizedes órát vagy pontos óra-perc formátumot választhatsz. Ez csak a megjelenítést módosítja; a tárolt percek és a számított összegek nem változnak.
        - A pénznem a tag alapértelmezett billing és riport beállításaiban használt érték.

        ### Hibaelhárítás

        - Elveszett authenticator app és tartalék kódok: kérj admin TOTP resetet.
        - Passkey belépés nem működik: lépj be másik módszerrel, majd ellenőrizd vagy töröld a passkey-t a Beállításokban.
        - Mágikus link után nincs kapcsolt tagprofil: azzal az email címmel lépj be, amellyel a meghívót aktiváltad.
        - Admin eszközök továbbra is blokkoltak: először állíts be authenticator-app ellenőrzést, utána a passkey belépés átugorhatja a kódkérést.
      `,
    },
    {
      id: "people",
      audience: "admin",
      title: "Emberek és hozzáférés",
      summary: "Meghívások, tagállapot, szerepkörváltás, profilváltás és helyreállítás.",
      bodyMarkdown: markdown`
        ## Emberek és hozzáférés

        Az Emberek oldal az admin felület a tagprofilok kezelésére. A tagprofil a Sheet Happens üzleti rekordja. A Better Auth felhasználó a meghívó aktiválása után kapcsolódik ehhez.

        ### Keresés

        - Használd a gyorskeresőt névre vagy emailre.
        - Szűrj állapot, szerepkör és profil szerint.
        - Nagy címtárnál használd a lapozást.
        - Mielőtt hiányzónak gondolsz egy tagot, töröld a szűrőket.

        ### Meghívási folyamat

        - Új meghívott taghoz név, email, profil, szerepkör, pénznem, időzóna és nyelv szükséges.
        - Az alap meghívó link 72 óráig érvényes.
        - A meghívott felhasználónak ugyanazzal az email címmel kell belépnie.
        - Aktiváláskor az auth felhasználó kapcsolódik a tagprofilhoz.
        - Ugyanarra az emailre duplikált meghívás blokkolva van.

        ### Tagállapotok

        - Meghívott: a profil létezik, de a meghívó még nincs aktiválva.
        - Aktív: a felhasználó be tud lépni és használhatja az engedélyezett funkciókat.
        - Inaktív: a hozzáférés tiltott, de a profil nincs archiválva.
        - Archivált: a profil kikerül a normál aktív folyamatokból, de ugyanannak a személynek újra aktiválható.

        ### Gyakori admin műveletek

        - Meghívó újraküldése, ha a felhasználó 72 órán belül nem aktivált.
        - Archivált tag reaktiválása, ha ugyanaz a személy visszatér.
        - Szerepkör váltása Tag és Admin között.
        - Profilváltás ütemezése Alkalmazott és Kontraktor között.
        - Munkamenetek visszavonása, ha azonnali hozzáférésfrissítés kell.
        - TOTP reset, ha a felhasználó elvesztette az authenticator hozzáférést és a tartalék kódokat.

        ### Hibaelhárítás

        - A felhasználó szerint lejárt a meghívó: küldd újra az Emberek oldalról.
        - Archivált felhasználónak újra hozzáférés kell: aktiváld újra, majd ellenőrizd szerepkört, profilt és projekt-hozzárendeléseket.
        - Belép, de nincs kapcsolt profil: ellenőrizd, hogy az auth email egyezik-e a tag emailjével, és aktiválták-e a meghívót.
        - Nem fér hozzá admin oldalakhoz: ellenőrizd, hogy Admin szerepköre van-e és be van-e állítva a TOTP.
        - Profilváltás nem látszik: ellenőrizd az ütemezett dátumot és az audit sorokat.
      `,
    },
    {
      id: "admin-payslips",
      audience: "admin",
      title: "Admin bérjegyzék kezelés",
      summary: "Havi alkalmazotti PDF feltöltés, csere, törlés és hozzáférés-naplózás.",
      bodyMarkdown: markdown`
        ## Admin bérjegyzék kezelés

        A bérjegyzék privát alkalmazotti dokumentum. Nem időbejegyzésekből számolódik, és független a kontraktori timesheetektől és számláktól.

        ### Havi bérjegyzék feltöltése

        - Nyisd meg az Admin navigáció **Bérjegyzékek** oldalát.
        - Válassz alkalmazotti profilt és payroll hónapot.
        - Legfeljebb 10 MB méretű PDF-et tölts fel.
        - A havi áttekintés azokat az aktív alkalmazottakat mutatja, akiknek még hiányzik a dokumentum; a névre kattintva előre kitöltődik a feltöltés.
        - Egy alkalmazotthoz és hónaphoz egy aktuális bérjegyzék tartozik.

        ### Csere és törlés

        - Javított PDF-hez használd a meglévő sor Csere műveletét.
        - A csere az adott alkalmazott/hónap aktuális dokumentuma lesz; a korábbi PDF a privát tárból törlődik.
        - Törlést csak akkor használj, ha az aktuális dokumentumot vissza kell vonni. A hónap később újra feltölthető.
        - Feltöltés, csere, törlés, előnézet és letöltés audit naplóbejegyzést hoz létre.

        ### Keresés és hibakezelés

        - Keress név vagy email alapján, és szűrj alkalmazottra vagy hónapra.
        - Régebbi rekordoknál lapozz; a szűrés a szerveren fut.
        - Az inaktív alkalmazott a történeti listában maradhat, de a havi hiánylista csak aktív alkalmazottakból készül.
        - Feltöltési hiba esetén a Rendszer oldalon ellenőrizd az objektumtár állapotát és konfigurációját.
      `,
    },
    {
      id: "projects",
      audience: "admin",
      title: "Projektek és hozzárendelések",
      summary:
        "Projekt életciklus, projektcsoportok, taghozzárendelés, tömeges hozzárendelés és színek.",
      bodyMarkdown: markdown`
        ## Projektek és hozzárendelések

        A projektek határozzák meg, hova lehet időt rögzíteni. Projekt nélküli időbejegyzés nem készíthető, ezért a projektbeállításnak munka előtt rendben kell lennie.

        ### Projektek

        - Hozz létre projekteket egyértelmű névvel és sluggal.
        - A státusz szabályozza, hogy a projekt elérhető-e.
        - Archiváld azokat a projekteket, amelyeknek ki kell kerülniük a normál aktív folyamatokból.
        - A projektszín vizuális azonosító az időrácsban, timesheetekben és riportokban.

        ### Projektcsoportok

        - A csoportok szervezési segédek.
        - Szűrésben és navigációban segítenek.
        - Önmagukban nem módosítanak billing, riport vagy hozzáférési szabályt.

        ### Hozzárendelések

        - Aktív vagy meghívott tagok is hozzárendelhetők projektekhez.
        - A kezdő és záró dátum határozza meg az időrögzítési jogosultságot.
        - A tag csak a projekt és a hozzárendelés érvényességi ablakán belül tud időt rögzíteni.
        - A tömeges hozzárendelés ismétlődő beállításoknál hasznos.

        ### Keresés és szűrők

        - Keress projektnévre vagy slugra.
        - Szűrj állapot, csoport és hozzárendelési szempontok alapján.
        - A projektcsoportoknak külön kereső és szűrő felületük van.
        - Duplikált beállítás előtt töröld a szűrőket.

        ### Hibaelhárítás

        - Nem látszik a projekt az Időkövetésben: ellenőrizd a projekt státuszát és a hozzárendelési dátumokat.
        - Egy adott napra nem menthető idő: ellenőrizd, hogy a dátum benne van-e a projekt és hozzárendelés érvényességi tartományában.
        - Rossz a színjelölő: frissítsd a projektszínt és töltsd újra az érintett nézeteket.
        - Duplikált hozzárendelési hiba: ellenőrizd a meglévő hozzárendeléseket, és átfedés helyett módosíts dátumot.
      `,
    },
    {
      id: "rates",
      audience: "admin",
      title: "Óradíjak és felülírások",
      summary: "Központi díjak, projektspecifikus felülírások, jövőbeli időszakok és átfedések.",
      bodyMarkdown: markdown`
        ## Óradíjak és felülírások

        Az óradíjak határozzák meg a rögzített idő pénzbeli értékét timesheethez és belső riporthoz. Rossz óradíj blokkolhatja a beküldést vagy vegyes pénznemű hónapot okozhat.

        ### Központi óradíjak

        - A központi díj egy taghoz és dátumidőszakhoz tartozik.
        - Alkalmazottaknak és kontraktoroknak is lehet belső díjuk.
        - Ha nincs projektfelülírás, a központi díj érvényesül.
        - A nyitott végű díj addig érvényes, amíg le nem zárják vagy le nem cserélik.

        ### Projektfelülírások

        - Kontraktor projektfelülírás eltérhet a központi díjtól.
        - A felülírás csak a kiválasztott projektre vonatkozik.
        - Más projektek továbbra is a központi díjat használják.
        - Akkor hasznos, ha egy kontraktornak projektspecifikus billing díja van.

        ### Pénznem szabályok

        - Beküldött hónapnak egy pénznemre kell számolódnia.
        - Pénznemváltás csak jövőbeli hónap első napjától indulhat.
        - Ha ma a hónap első napja, az új pénznem indulhat ma.
        - Vegyes pénznemű hónapot nyitott óradíj-időszak javításával kell rendezni, nem kontraktori művelettel.

        ### Időszak módosítása

        - Átfedő díjidőszak nem menthető.
        - Ha egy díj zárt hónapokon is áthalad, a zárt részt meg kell őrizni.
        - Jövőbeli javításnál csak a nyitott részt vágd szét vagy cseréld.
        - A történeti timesheet snapshotoknak stabilnak kell maradniuk.

        ### Hibaelhárítás

        - A timesheet hiányzó díjat jelez: adj központi díjat vagy projektfelülírást, amely lefedi a bejegyzés dátumát.
        - A timesheet vegyes pénznemet jelez: vizsgáld meg a központi és projektfelülírás díjakat az adott hónapban.
        - Nem hozható létre jövőbeli díj, mert nyitott díj átfed: előbb vágd szét vagy cseréld a nyitott időszakot.
        - Csere kezdődátum hibát kapsz: split/csere csak biztonságosan rövidíthető időszakon használható, vagy még nem beküldött időszaknál közvetlen szerkesztés kell.
      `,
    },
    {
      id: "admin-timesheets",
      audience: "admin",
      title: "Admin timesheet ellenőrzés",
      summary:
        "Ellenőrzés, elutasítás, jóváhagyás, számlaellenőrzés, sztornó számla és fizetett státusz.",
      bodyMarkdown: markdown`
        ## Admin timesheet ellenőrzés

        Az admin ellenőrzés külön folyamat a nyers időkövetéstől. A kontraktor havi revíziót küld be; az admin a változtathatatlan snapshotot ellenőrzi, majd kezeli a számlaellenőrzést.

        ### Beküldött timesheet ellenőrzése

        - Nyisd meg az Admin / Jóváhagyás oldalt.
        - Szűrj vagy keress beküldött kontraktori timesheetekre.
        - Nyisd meg a beküldött hónapot.
        - Ellenőrizd a projektek óráit, díjait, pénznemét és összegét.
        - Gyanús korrekciónál használd az audit vagy történeti adatokat.

        ### Jóváhagyás vagy elutasítás

        - Akkor hagyd jóvá, ha a beküldött revízió helyes.
        - Akkor utasítsd el, ha a nyers idő, projekt-hozzárendelés, óradíj vagy pénznem hibás.
        - Az elutasításhoz adj olyan indokot, amiből a kontraktor tudja, mit javítson.
        - Elutasítás után a kontraktor javítja a nyers időt és új revíziót küld be.

        ### Számlaellenőrzés

        - Jóváhagyás után a kontraktor feltölti a számla PDF-et.
        - Hasonlítsd össze a renderelt PDF-et a jóváhagyott összegekkel és metaadatokkal.
        - Csak helyes számlát fogadj el.
        - Hibásan kiállított számlánál előbb sztornó számlát kérj.
        - Sztornó után fogadható el a javított csere számla.
        - Fizetettnek csak a pénzügyi/kifizetési lépés után jelöld.

        ### Hibaelhárítás

        - A kontraktor hiányzó díj miatt nem tud beküldeni: javítsd a díjakat, majd kérd újrapróbálásra.
        - Vegyes pénznem miatt nem tud beküldeni: javítsd az óradíj-időszakokat az adott hónapra.
        - Beküldött hónapot kell módosítani: utasítsd el a timesheetet, hogy a zárolt bejegyzések javíthatók legyenek.
        - Számla előnézet nem elérhető: ellenőrizd az objektumtárat és a fájl metaadatait.
        - PDF export/renderelés máshol hibázik: ellenőrizd a Rendszer oldalon a Typst elérhetőségét.
      `,
    },
    {
      id: "reports",
      audience: "admin",
      title: "Riportok és PDF exportok",
      summary:
        "Szerveroldali szűrők, csoportosított riportok, költségmentes exportok és Typst PDF generálás.",
      bodyMarkdown: markdown`
        ## Riportok és exportok

        A riportok a nyers időbejegyzésekből készülnek. A timesheet snapshot a kontraktori billing miatt fontos, de a riportálás alapja a rögzített munka.

        ### Szűrés

        - Dátumtartománnyal válaszd ki a riport időszakát.
        - Szűrj tagra, projektre és projektcsoportra.
        - Nagy adatmennyiségnél szerveroldali szűrés fut.
        - Export előtt ellenőrizd az aktív szűrőket.

        ### Riport nézetek

        - Tagközpontú nézetben személyek és összesített órák hasonlíthatók össze.
        - Projektközpontú nézetben delivery és projektterhelés látszik.
        - Csoportszűrők kapcsolódó projektek összesítését segítik.
        - Hiányzó díj maradjon hiányzóként látható, ne váljon csendben nullává.

        ### Exportok

        - A költségmentes export elrejti az óradíjakat és számított összegeket.
        - A belső export díjakat és összegeket tartalmaz, ezért körültekintően oszd meg.
        - A PDF export Typst-tel készül az alkalmazás runtime-ban.
        - CSV vagy táblázatos exportnál ugyanazokat a szűrőket kell ellenőrizni, mint a képernyőn.

        ### Hibaelhárítás

        - Üres export: ellenőrizd a dátumtartományt, tagot, projektet és csoportszűrőt.
        - Hiányzó összegek: ellenőrizd a kiválasztott időszak óradíjait.
        - PDF export hibázik: kérj admin ellenőrzést a Rendszer oldalon Typst és objektumtár ügyben.
        - Az értékek eltérnek egy beküldött timesheettől: a riport nyers bejegyzést használ, a timesheet beküldött snapshotot.
      `,
    },
    {
      id: "audit-system",
      audience: "admin",
      title: "Audit napló és rendszerellenőrzések",
      summary: "Admin műveletek és telepítési konfigurációk ellenőrizhetősége.",
      bodyMarkdown: markdown`
        ## Audit napló és rendszerellenőrzések

        Az audit és rendszer oldalak segítenek megérteni, mi történt, illetve megfelelően van-e konfigurálva a környezet.

        ### Audit napló

        - Az audit sorok fontos admin és workflow műveleteket rögzítenek.
        - Kereshető művelet, céltípus, szereplő és dátumtartomány alapján.
        - A részletekben összehasonlítható az előtte és utána állapot.
        - Érzékenynek tűnő mezők a felületen maszkolva jelennek meg.
        - Szerepkörváltás, díjváltozás, TOTP reset, timesheet státuszváltás, számlaművelet és riport export vizsgálatánál használd.

        ### Rendszerellenőrzések

        - Deploy vagy környezeti változó módosítás után használd a Rendszer oldalt.
        - Ellenőrizd az alkalmazás URL és auth beállításokat.
        - Ellenőrizd az adatbázis kapcsolatot.
        - Számlafeltöltés előtt ellenőrizd az objektumtárat.
        - Meghívó vagy mágikus link teszt előtt ellenőrizd az email kézbesítést.
        - Céges Google belépésnél ellenőrizd a Google OAuth állapotot.
        - Riport PDF export előtt ellenőrizd a Typst elérhetőséget.

        ### Hibaelhárítás

        - OAuth belépés visszairányítás után hibázik: ellenőrizd a publikus URL változókat és a Google redirect URI-t.
        - Nem érkeznek mágikus linkek: ellenőrizd az SMTP beállítást vagy a console kézbesítési módot.
        - Számlafeltöltés hibázik: ellenőrizd az objektumtár hitelesítést és bucket hozzáférést.
        - PDF export hibázik: ellenőrizd, hogy a Typst elérhető-e a deployolt runtime-ban.
        - Hiányzik egy audit esemény: győződj meg róla, hogy a művelet tényleg befejeződött, és a szűrők nem rejtik el.
      `,
    },
    {
      id: "info-page",
      audience: "admin",
      title: "Súgó üdvözlő tartalma",
      summary: "Admin által karbantartott markdown tartalom a Súgó / Üdvözlő fülön.",
      bodyMarkdown: markdown`
        ## Súgó üdvözlő tartalma

        A Súgónak két tartalomforrása van. Az Üdvözlő fület adminok szerkesztik az appban. A Kézikönyv fül forráskódban karbantartott, és pontos termék-referenciaként kezelendő.

        ### Üdvözlő fül

        - Használd könnyed onboarding megjegyzésekhez.
        - Ide kerülhet csapatspecifikus kontakt, átmeneti bejelentés vagy környezetspecifikus útmutató.
        - Maradjon elég rövid ahhoz, hogy új felhasználók gyorsan átfussák.
        - Közzétételkor változtathatatlan verzió és audit sor jön létre.

        ### Kézikönyv fül

        - A Kézikönyv fül forráskódban karbantartott.
        - Funkcióváltozáskor ezt is frissíteni kell.
        - Nem-admin felhasználók látják a korlátozott témák nevét, de nem a részletes működési információt.
        - Admin részletek maradjanak admin témákban.

        ### Támogatott Markdown

        - Címsorok.
        - Félkövér és dőlt szöveg.
        - Számozott és felsorolásos listák.
        - Idézetek.
        - Linkek.
        - Inline kód.
        - Nyers HTML nem renderelődik.

        ### Hibaelhárítás

        - Nem látszik a közzétett tartalom: frissítsd a Súgót, és ellenőrizd, hogy sikeres volt-e a közzététel.
        - Rossz a formázás: ellenőrizd, hogy a támogatott Markdown részhalmazt használja-e a szöveg.
        - Elavult egy kézikönyv téma: frissítsd a forráskódban lévő manual tartalmat és deployolj.
        - Korlátozott felhasználó túl sok részletet lát: ellenőrizd a téma audience értékét és a hozzáférési szabályokat.
      `,
    },
  ],
};

export function getManualTopicsForAccess(input: ManualAccessInput): ManualTopicView[] {
  const locale = resolveHelpLocale(input.locale);

  return manualTopics[locale].map((topic) => ({
    ...topic,
    accessible: canAccessManualTopic(topic, input),
  }));
}

export function getDefaultWelcomeInfoPage(locale: string): DefaultWelcomeInfoPage {
  return defaultWelcomeInfoPages[resolveHelpLocale(locale)];
}

export function resolveHelpLocale(locale: string): HelpLocale {
  return locale === "hu" ? "hu" : "en";
}

function canAccessManualTopic(topic: ManualTopic, input: ManualAccessInput) {
  if (input.role === "ADMIN") return true;
  if (topic.audience === "all") return true;
  if (topic.audience === "employee") return input.profile === "EMPLOYEE";
  if (topic.audience === "contractor") return input.profile === "CONTRACTOR";
  return false;
}
