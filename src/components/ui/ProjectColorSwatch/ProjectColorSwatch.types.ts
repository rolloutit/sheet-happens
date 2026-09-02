import type { ProjectColorToken } from "@/src/lib/project-colors";

export type ProjectColorSwatchSize = "sm" | "md" | "lg";

export type ProjectColorSwatchProps = {
  colorToken: ProjectColorToken;
  size?: ProjectColorSwatchSize;
  className?: string;
};
