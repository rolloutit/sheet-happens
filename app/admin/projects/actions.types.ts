export type ProjectFormField = "name" | "slug" | "startsOn" | "endsOn" | "isInternal" | "notes";

export type ProjectActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<ProjectFormField, string>>;
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
