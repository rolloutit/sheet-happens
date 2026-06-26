import type { ProjectDrawerData } from "../ProjectDrawer";
import type { RateDrawerData } from "../RateDrawer";
import type { PersonTableRow } from "../PeopleTable";

export type ManagementView = "people" | "projects" | "rates";

export type ManagementViewsProps = {
  view?: ManagementView;
  onViewChange?: (view: ManagementView) => void;
  people?: PersonTableRow[];
  projects?: ProjectDrawerData[];
  rates?: RateDrawerData[];
  onPersonEdit?: (person: PersonTableRow) => void;
  onPersonDelete?: (person: PersonTableRow) => void;
  onProjectSave?: (project: ProjectDrawerData) => void;
  onProjectActiveChange?: (project: ProjectDrawerData, active: boolean) => void;
  onRateSave?: (rate: RateDrawerData) => void;
  onInvite?: () => void;
  className?: string;
};
