export type ProjectFormField = "name" | "slug" | "startsOn" | "endsOn" | "isInternal" | "notes";

export type ProjectAssignmentFormField = "memberId" | "validFrom" | "validTo" | "active" | "notes";

export type ProjectGroupFormField = "name" | "slug" | "description" | "active";

export type ProjectGroupProjectFormField = "projectGroupId" | "projectId";

export type ProjectActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<ProjectFormField, string>>;
};

export type ProjectAssignmentActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<ProjectAssignmentFormField, string>>;
};

export type ProjectGroupActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<ProjectGroupFormField, string>>;
};

export type ProjectGroupProjectActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<ProjectGroupProjectFormField, string>>;
};

export type UpdateProjectActionInput = {
  projectId: string;
  name: string;
  slug: string;
  startsOn: string;
  endsOn: string;
  isInternal: boolean;
  notes: string;
};

export type AssignProjectMemberActionInput = {
  projectId: string;
  memberId: string;
  validFrom: string;
  validTo: string;
  active: boolean;
  notes: string;
};

export type UpdateProjectAssignmentActionInput = {
  assignmentId: string;
  validFrom: string;
  validTo: string;
  active: boolean;
  notes: string;
};

export type CloseProjectAssignmentActionInput = {
  assignmentId: string;
  validTo: string;
};

export type CreateProjectGroupActionInput = {
  name: string;
  slug: string;
  description: string;
  active: boolean;
};

export type UpdateProjectGroupActionInput = CreateProjectGroupActionInput & {
  projectGroupId: string;
};

export type AddProjectToGroupActionInput = {
  projectGroupId: string;
  projectId: string;
};

export type RemoveProjectFromGroupActionInput = AddProjectToGroupActionInput;
