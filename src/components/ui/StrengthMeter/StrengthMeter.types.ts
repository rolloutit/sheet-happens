import type { HTMLAttributes } from "react";

export type StrengthMeterScore = 0 | 1 | 2 | 3 | 4;

export type StrengthRequirement = {
  id: string;
  label: string;
  met: boolean;
};

export type PasswordStrengthResult = {
  score: StrengthMeterScore;
  requirements: StrengthRequirement[];
};

export type StrengthMeterLabels = Partial<Record<StrengthMeterScore, string>>;

export type StrengthMeterProps = HTMLAttributes<HTMLDivElement> & {
  score: StrengthMeterScore;
  label?: string;
  helperText?: string;
  labels?: StrengthMeterLabels;
  requirements?: StrengthRequirement[];
};
