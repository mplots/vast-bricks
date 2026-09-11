/** One @VastSetting(databaseOverride = true) field, as shown to a tenant. */
export interface VastSetting {
  settingKey: string;
  group: string;
  label: string;
  secret: boolean;
  /** Whether this tenant has an override stored - what a reset has to offer to clear. */
  configured: boolean;
  /** Null for a secret setting: the screen only ever writes one, it never reads one back. */
  value: string | null;
}

export interface VastSettingsPage {
  settings: VastSetting[];
}
