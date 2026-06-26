import type { AvatarTone } from "@/src/components/ui/Avatar";
import type { TableSort } from "@/src/components/ui/Table";

export type PersonRowState = "active" | "inactive" | "invited" | "locked";

export type PersonTableRow = {
  id: string;
  name: string;
  email: string;
  profile: string;
  state: PersonRowState;
  currency: string;
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
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort) => void;
  loading?: boolean;
  labels?: PeopleTableLabels;
  className?: string;
};
