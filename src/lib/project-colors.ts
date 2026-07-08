export const PROJECT_COLOR_TOKENS = [
  "teal",
  "cyan",
  "mint",
  "amber",
  "rose",
  "blue",
  "violet",
  "slate",
] as const;

export type ProjectColorToken = (typeof PROJECT_COLOR_TOKENS)[number];

export const DEFAULT_PROJECT_COLOR_TOKEN: ProjectColorToken = "teal";

export type ProjectColorOption = {
  value: ProjectColorToken;
  label: string;
};

export const projectColorValues: Record<ProjectColorToken, string> = {
  teal: "#1f7475",
  cyan: "#37e3de",
  mint: "#5fdaa8",
  amber: "#ffc68b",
  rose: "#ff6b6b",
  blue: "#6aa5ff",
  violet: "#9d8cff",
  slate: "#9eb9b1",
};

export const projectColorOptions: ProjectColorOption[] = [
  { value: "teal", label: "Teal" },
  { value: "cyan", label: "Cyan" },
  { value: "mint", label: "Mint" },
  { value: "amber", label: "Amber" },
  { value: "rose", label: "Rose" },
  { value: "blue", label: "Blue" },
  { value: "violet", label: "Violet" },
  { value: "slate", label: "Slate" },
];

const projectColorTokenSet = new Set<string>(PROJECT_COLOR_TOKENS);

export function isProjectColorToken(value: unknown): value is ProjectColorToken {
  return typeof value === "string" && projectColorTokenSet.has(value);
}

export function getProjectColorLabel(colorToken: ProjectColorToken) {
  return projectColorOptions.find((option) => option.value === colorToken)?.label ?? colorToken;
}
