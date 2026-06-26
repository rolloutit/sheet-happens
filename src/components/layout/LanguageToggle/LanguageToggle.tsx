import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import type { LanguageToggleProps } from "./LanguageToggle.types";

const defaultOptions = [
  { value: "hu", label: "HU" },
  { value: "en", label: "EN" },
];

export function LanguageToggle({
  value,
  options = defaultOptions,
  label = "Language",
  size = "sm",
  width = "auto",
  onValueChange,
  className,
  ...props
}: LanguageToggleProps) {
  return (
    <SegmentedControl
      label={label}
      value={value}
      items={options}
      size={size}
      width={width}
      onValueChange={onValueChange}
      className={className}
      {...props}
    />
  );
}
