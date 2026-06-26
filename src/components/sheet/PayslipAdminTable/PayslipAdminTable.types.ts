import type { AvatarTone } from "@/src/components/ui/Avatar";
import type { TableSort } from "@/src/components/ui/Table";
import type { PayslipStatus } from "../PayslipStatus";

export type PayslipAdminRow = {
  id: string;
  person: string;
  email?: string;
  month: string;
  status: PayslipStatus;
  fileName?: string;
  avatarTone?: AvatarTone;
};

export type PayslipAdminTableLabels = {
  empty?: string;
  preview?: (row: PayslipAdminRow) => string;
  download?: (row: PayslipAdminRow) => string;
  upload?: (row: PayslipAdminRow) => string;
  open?: (row: PayslipAdminRow) => string;
};

export type PayslipAdminTableProps = {
  rows: PayslipAdminRow[];
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort) => void;
  onPreview?: (row: PayslipAdminRow) => void;
  onDownload?: (row: PayslipAdminRow) => void;
  onUpload?: (row: PayslipAdminRow) => void;
  onRowOpen?: (row: PayslipAdminRow) => void;
  loading?: boolean;
  labels?: PayslipAdminTableLabels;
  className?: string;
};
