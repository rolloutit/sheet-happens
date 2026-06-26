export type InfoPageStatus = "draft" | "published";

export type InfoPageEditorValue = {
  title: string;
  slug: string;
  body: string;
  status?: InfoPageStatus;
  updatedAt?: string;
};

export type InfoPageEditorLabels = {
  title?: string;
  description?: string;
  titleField?: string;
  slugField?: string;
  bodyField?: string;
  editTab?: string;
  previewTab?: string;
  save?: string;
  publish?: string;
};

export type InfoPageEditorProps = {
  value: InfoPageEditorValue;
  labels?: InfoPageEditorLabels;
  className?: string;
  onValueChange?: (value: InfoPageEditorValue) => void;
  onSave?: (value: InfoPageEditorValue) => void;
  onPublish?: (value: InfoPageEditorValue) => void;
};
