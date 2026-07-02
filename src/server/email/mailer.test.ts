import { describe, expect, it, vi } from "vitest";

import { createMailer, getEmailDeliveryMode } from "./mailer";

describe("mailer", () => {
  it("defaults unknown modes to console delivery", () => {
    expect(getEmailDeliveryMode(undefined)).toBe("console");
    expect(getEmailDeliveryMode("smtp")).toBe("smtp");
    expect(getEmailDeliveryMode("unknown")).toBe("console");
  });

  it("logs console emails without throwing", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await createMailer("console").send({
      to: "user@example.com",
      subject: "Subject",
      text: "Message",
    });

    expect(info).toHaveBeenCalledWith(expect.stringContaining("user@example.com"));
    info.mockRestore();
  });
});
