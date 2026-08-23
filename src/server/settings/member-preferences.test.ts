import { describe, expect, it } from "vitest";

import { MEMBER_AVATAR_MAX_BYTES, MemberPreferenceError, validateMemberAvatar } from ".";

describe("member avatar validation", () => {
  it.each([
    ["image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
  ])("accepts a signed %s image", (contentType, bytes) => {
    expect(() =>
      validateMemberAvatar({
        bytes,
        contentType,
        byteSize: bytes.length,
        originalFilename: "avatar",
      }),
    ).not.toThrow();
  });

  it.each([
    ["empty", Buffer.alloc(0), "image/png", 0, "Avatar image is required."],
    [
      "oversized",
      Buffer.from([0xff, 0xd8, 0xff]),
      "image/jpeg",
      MEMBER_AVATAR_MAX_BYTES + 1,
      "Avatar image is too large.",
    ],
    ["wrong type", Buffer.from("GIF89a"), "image/gif", 6, "Avatar must be a PNG or JPEG image."],
    ["spoofed PNG", Buffer.from("not png"), "image/png", 7, "Avatar must be a PNG or JPEG image."],
  ])("rejects an %s file", (_name, bytes, contentType, byteSize, message) => {
    expect(() =>
      validateMemberAvatar({ bytes, contentType, byteSize, originalFilename: "avatar" }),
    ).toThrow(new MemberPreferenceError(message));
  });
});
