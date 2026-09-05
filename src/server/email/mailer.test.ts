import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createMailer, getEmailDeliveryMode, getEmailOutboxPath } from "./mailer";

describe("mailer", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults unknown modes to console delivery", () => {
    expect(getEmailDeliveryMode(undefined)).toBe("console");
    expect(getEmailDeliveryMode("smtp")).toBe("smtp");
    expect(getEmailDeliveryMode("unknown")).toBe("console");
    expect(getEmailDeliveryMode("file")).toBe("file");
  });

  it("refuses file delivery in production, so plaintext links never reach a real deploy", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(getEmailDeliveryMode("file")).toBe("console");
  });

  it("appends file emails to the outbox as one JSON object per line", async () => {
    const outbox = path.join(await mkdtemp(path.join(tmpdir(), "outbox-")), "outbox.jsonl");
    vi.stubEnv("AUTH_EMAIL_FILE", outbox);

    expect(getEmailOutboxPath()).toBe(outbox);

    const mailer = createMailer("file");
    await mailer.send({ to: "first@example.com", subject: "One", text: "1" });
    await mailer.send({ to: "second@example.com", subject: "Two", text: "2", html: "<p>2</p>" });

    const lines = (await readFile(outbox, "utf8"))
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ to: "first@example.com", subject: "One" });
    expect(lines[1]).toMatchObject({ to: "second@example.com", html: "<p>2</p>" });
    expect(lines[0].sentAt).toEqual(expect.any(String));
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
