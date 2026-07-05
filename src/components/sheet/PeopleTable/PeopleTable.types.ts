import type { AvatarTone } from "@/src/components/ui/Avatar";
import type { ReactNode } from "react";
import type { TableSort } from "@/src/components/ui/Table";

export type PersonRowState = "active" | "inactive" | "invited" | "locked";
export type PersonRoleValue = "ADMIN" | "MEMBER";

export type PersonTableRow = {
  id: string;
  name: string;
  email: string;
  profile: string;
  role?: string;
  roleValue?: PersonRoleValue;
  state: PersonRowState;
  currency: string;
  hasAuthUser?: boolean;
  avatarTone?: AvatarTone;
};

export type PeopleTableLabels = {
  edit?: (row: PersonTableRow) => string;
  delete?: (row: PersonTableRow) => string;
  open?: (row: PersonTableRow) => string;
  empty?: string;
};

export type PeopleTableProps = {
  rows: PersonTableRow[];
  onEdit?: (row: PersonTableRow) => void;
  onDelete?: (row: PersonTableRow) => void;
  onRowOpen?: (row: PersonTableRow) => void;
  rowActions?: (row: PersonTableRow) => ReactNode;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort) => void;
  loading?: boolean;
  labels?: PeopleTableLabels;
  className?: string;
};
