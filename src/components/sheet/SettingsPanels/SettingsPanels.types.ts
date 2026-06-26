import type { NotificationPreferencesProps } from "../NotificationPreferences";
import type { PreferenceControlsProps } from "../PreferenceControls";
import type { ProfileSettingsPanelProps } from "../ProfileSettingsPanel";
import type { SecurityMethod, SecurityMethodListProps } from "../SecurityMethodList";
import type { TotpSetupDialogProps } from "../TotpSetupDialog";

export type SettingsSection = "profile" | "security" | "preferences" | "notifications";

export type SettingsPanelsProps = {
  section?: SettingsSection;
  onSectionChange?: (section: SettingsSection) => void;
  profile?: Omit<ProfileSettingsPanelProps, "className">;
  securityMethods?: SecurityMethod[];
  security?: Omit<SecurityMethodListProps, "methods" | "className" | "onMethodAction">;
  totp?: Omit<TotpSetupDialogProps, "trigger">;
  preferences?: Omit<PreferenceControlsProps, "className">;
  notifications?: Omit<NotificationPreferencesProps, "className">;
  onSecurityMethodAction?: (method: SecurityMethod) => void;
  className?: string;
};
