# Component Library Rules

The component library lives inside the app for v1.

- `src/components/ui`: reusable shadcn/Radix-derived primitives.
- `src/components/sheet`: Sheet Happens product components from the Claude design inventory.
- `src/components/layout`: shell, navigation, page layout, providers, and drawers.

Folder convention:

- Every instantiable component gets a PascalCase folder.
- The implementation file uses the component name: `Button/Button.tsx`.
- Public props live in `Button.types.ts` when the component has exported props.
- CVA or other reusable variant definitions live in `Button.variants.ts`.
- `index.ts` is the component's public import surface.
- Stories, tests, and component-local helpers stay colocated in the same folder.

Example:

```txt
Button/
  Button.tsx
  Button.types.ts
  Button.variants.ts
  Button.stories.tsx
  index.ts
```

Rules:

- Components are functional components with explicit exported prop types.
- Visual differences use typed variant props instead of boolean prop combinations.
- Use `className` only where extension is intentional.
- Prefer Server Components by default; add `"use client"` only for state, effects, browser APIs, timers, forms with live validation, and Radix interactive primitives.
- Every reusable component needs Storybook coverage for variants, disabled/loading/error/empty states, dark/light theme, and mobile-relevant states.
- Behavior gets a Storybook `play` test or a Vitest/Testing Library test.

API conventions:

- Export named public types from `*.types.ts`; component folders should not require importing private implementation details.
- Prefer `variant`, `size`, `tone`, `density`, `state`, `mode`, and `status` for typed visual/state choices.
- Keep boolean props for true binary behavior such as `disabled`, `loading`, `checked`, `open`, and `required`.
- Avoid visual boolean clusters such as `primary`, `danger`, `small`, or `muted`; model those as typed variants.
- Use discriminated unions for workflow/status-heavy product components.
- Interactive non-button surfaces must render a real `button`/`a` or implement explicit keyboard semantics, labels, and focus state.
- Callback props report user intent, not app-side persistence. Server mutations and optimistic state belong at screen level.
- File/input primitives should expose accepted/rejected or valid/invalid paths separately when the caller needs to show app-specific errors.

Quality gates:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm format`
- `pnpm test`
- `pnpm build-storybook`
- `pnpm test-storybook`
- `pnpm test:visual`
- `pnpm e2e`

Visual baseline workflow:

- `pnpm test:visual` rebuilds Storybook and compares the checked-in Playwright screenshots.
- `pnpm test:visual:update` refreshes those screenshots for intentional visual changes.

Implemented coverage:

- UI primitives: Avatar, Badge, BulkBar, Button, Calendar, Card, Checkbox, ChipButton, CodeInput, Combobox, Command, DataTable, DatePicker, DateRangePicker, Dialog, Drawer, Dropdown, Dropzone, ErrorState, Field, FormMessage, FormSection, IconButton, Input, ListRow, LockedState, MonthPicker, Pager, PasswordInput, Popover, SectionHead, SegmentedControl, Select, Skeleton, StrengthMeter, Switch, Tabs, Textarea, TimeInput, Tooltip.

Form control conventions:

- `Select` is the default single-select. It renders a Radix menu, and switches to the
  searchable `Combobox` above `defaultSearchThreshold` options. Reach for `Combobox`
  directly only when a list must always be searchable. Both paths honour `name`,
  `defaultValue`, `required`, `invalid`, and `form.reset()`, and share one trigger surface
  (`controlSurface.ts`) so the switch is invisible.
- Dates are `YYYY-MM-DD` strings and months are `YYYY-MM` strings, never `Date` objects —
  `DatePicker`, `DateRangePicker`, and `MonthPicker` all convert at their own boundary. See
  `src/lib/date-values.ts`.
- Pickers take a required `locale` and a `labels` object; like every other primitive they
  never call `useTranslations` themselves.
- `TimeInput` is a styling wrapper around the native `<input type="time">`, deliberately not
  a popover. See the note on the component before changing it.
- Product blocks: AuthScreens, ChartPrimitives, DashboardCards, DayDetailPanel, DocumentPreview, EmptyState, FlaggedUserList, InfoPageEditor, InvoiceUploadPanel, MonthRow, NotificationPreferences, PayslipAdminTable, PayslipMonthList, Payslips, PayslipSummaryCard, PayslipUploadPanel, PayslipViewer, PdfViewer, PeopleTable, PreferenceControls, ProfileSettingsPanel, ProjectDrawer, RateDrawer, ReportChartCard, ReportExportDialog, ReportFilterBar, Reports, ReportStatTile, RejectDialog, ReviewActionBar, ReviewDiffList, ReviewQueueTable, SecurityMethodList, SettingsPanels, StatCard, StatusOverview, StatusPill, SubmitTimesheetDialog, TimeBreakdownDialog, TimeEntryForm, TimeGridTimer, TimesheetStepper, TimesheetSummaryCard, TotpSetupDialog, WeeklyTimeGrid, TimesheetComponents, AdminReview, ManagementViews, Toast, TweaksPanel.
- Layout blocks: AppShell, CommandPalette, CommandPill, LanguageToggle, MobileBottomBar, NotificationButton, ThemeProvider, UserMenu.

Readiness tracking:

- See `docs/component-library-audit.md` for the current inventory, API audit, and hardening backlog.
