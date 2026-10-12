import { describe, expect, it } from "vitest";

import {
  decodeJwtPayload,
  getGoogleAuthSettings,
  isAllowedGoogleWorkspaceProfile,
  parseDomainList,
} from "./sign-in-methods";

describe("Google auth settings", () => {
  it("enables Google only when credentials and domains are configured", () => {
    expect(
      getGoogleAuthSettings({
        AUTH_GOOGLE_CLIENT_ID: "client",
        AUTH_GOOGLE_CLIENT_SECRET: "secret",
        AUTH_GOOGLE_ALLOWED_DOMAINS: "acme.example",
      }),
    ).toEqual({
      enabled: true,
      clientId: "client",
      clientSecret: "secret",
      allowedDomains: ["acme.example"],
      hostedDomain: "acme.example",
    });

    expect(
      getGoogleAuthSettings({
        AUTH_GOOGLE_CLIENT_ID: "client",
        AUTH_GOOGLE_CLIENT_SECRET: "secret",
      }).enabled,
    ).toBe(false);
  });

  it("deduplicates and normalizes allowed domains", () => {
    expect(parseDomainList(" Acme.EXAMPLE,acme.example, example.com, invalid, @bad.test ")).toEqual(
      ["acme.example", "example.com"],
    );
  });

  it("uses wildcard hosted-domain enforcement for multiple configured domains", () => {
    expect(
      getGoogleAuthSettings({
        AUTH_GOOGLE_CLIENT_ID: "client",
        AUTH_GOOGLE_CLIENT_SECRET: "secret",
        AUTH_GOOGLE_ALLOWED_DOMAINS: "acme.example,example.com",
      }).hostedDomain,
    ).toBe("*");
  });
});

describe("Google Workspace profile policy", () => {
  it("accepts verified Google Workspace profiles from allowed domains", () => {
    expect(
      isAllowedGoogleWorkspaceProfile(
        {
          email: "admin@acme.example",
          email_verified: true,
          hd: "acme.example",
        },
        ["acme.example"],
      ),
    ).toBe(true);
  });

  it("rejects private or unverified Google profiles", () => {
    expect(
      isAllowedGoogleWorkspaceProfile(
        {
          email: "admin@acme.example",
          email_verified: true,
        },
        ["acme.example"],
      ),
    ).toBe(false);

    expect(
      isAllowedGoogleWorkspaceProfile(
        {
          email: "admin@gmail.com",
          email_verified: true,
          hd: "gmail.com",
        },
        ["acme.example"],
      ),
    ).toBe(false);

    expect(
      isAllowedGoogleWorkspaceProfile(
        {
          email: "admin@acme.example",
          email_verified: false,
          hd: "acme.example",
        },
        ["acme.example"],
      ),
    ).toBe(false);
  });
});

describe("JWT payload decoding", () => {
  it("decodes base64url JWT payloads without validating the token", () => {
    const payload = Buffer.from(JSON.stringify({ email: "admin@acme.example" })).toString(
      "base64url",
    );

    expect(decodeJwtPayload(`header.${payload}.signature`)).toEqual({
      email: "admin@acme.example",
    });
  });

  it("returns null for malformed payloads", () => {
    expect(decodeJwtPayload("not-a-token")).toBeNull();
    expect(decodeJwtPayload("header.not-json.signature")).toBeNull();
  });
});
