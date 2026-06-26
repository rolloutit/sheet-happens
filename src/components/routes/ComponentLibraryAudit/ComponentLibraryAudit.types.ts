export type ComponentLibraryAuditSurface =
  | "dashboard"
  | "time"
  | "timesheets"
  | "review"
  | "management"
  | "reports"
  | "settings"
  | "payslips"
  | "info";

export type ComponentLibraryAuditSurfaceOption = {
  id: ComponentLibraryAuditSurface;
  label: string;
  description: string;
};
