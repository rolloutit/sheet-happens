import { describe, expect, it } from "vitest";

import {
  notificationConfigurationDefaults,
  NotificationConfigurationError,
  validateNotificationConfiguration,
} from "./configuration";

describe("notification configuration", () => {
  it("accepts the default 72-hour invoice delay", () => {
    expect(() =>
      validateNotificationConfiguration(notificationConfigurationDefaults),
    ).not.toThrow();
  });

  it("accepts arbitrary whole-hour delay and repeat values", () => {
    expect(() =>
      validateNotificationConfiguration({
        ...notificationConfigurationDefaults,
        invoiceInitialDelayHours: 73,
        invoiceRepeatIntervalHours: 25,
      }),
    ).not.toThrow();
  });

  it("rejects invalid timezones and fractional intervals", () => {
    expect(() =>
      validateNotificationConfiguration({
        ...notificationConfigurationDefaults,
        companyTimezone: "Not/A_Timezone",
      }),
    ).toThrow(NotificationConfigurationError);
    expect(() =>
      validateNotificationConfiguration({
        ...notificationConfigurationDefaults,
        invoiceInitialDelayHours: 72.5,
      }),
    ).toThrow(NotificationConfigurationError);
  });

  it("requires every configurable notification rule exactly once", () => {
    expect(() =>
      validateNotificationConfiguration({
        ...notificationConfigurationDefaults,
        rules: notificationConfigurationDefaults.rules.slice(1),
      }),
    ).toThrow(NotificationConfigurationError);
  });
});
