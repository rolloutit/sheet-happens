import { describe, expect, it } from "vitest";

import { buildSignedOAuthQuery, hasSignedOAuthQuery } from "./oauth-signed-query";

/**
 * A real consent-page query, captured from the provider. `ba_param` names every parameter that went
 * into the HMAC — including itself and `exp` — and `sig` is the HMAC.
 */
const SIGNED_SEARCH =
  "?response_type=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A33418%2Fcallback" +
  "&scope=openid+profile+offline_access+time%3Aread+time%3Awrite&state=spike-state" +
  "&client_id=zUpfFsrIEtmAsHLjuGtaEvMqIWecrngz" +
  "&code_challenge=RzpHERnvcadsWuu5TpxLq_IbHAlc7PMT-v85x09-7Wg&code_challenge_method=S256" +
  "&resource=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fmcp&exp=1788788328&ba_iat=1788787728684" +
  "&ba_param=ba_iat&ba_param=ba_param&ba_param=client_id&ba_param=code_challenge" +
  "&ba_param=code_challenge_method&ba_param=exp&ba_param=redirect_uri&ba_param=resource" +
  "&ba_param=response_type&ba_param=scope&ba_param=state" +
  "&sig=klpFnMKbEJWUx4c0fQN28xwzRgVRfDDFx7IL5SSq%2Fgo%3D";

describe("buildSignedOAuthQuery", () => {
  it("keeps the signature, the signed names, and every signed parameter", () => {
    const result = new URLSearchParams(buildSignedOAuthQuery(SIGNED_SEARCH));

    expect(result.get("sig")).toBe("klpFnMKbEJWUx4c0fQN28xwzRgVRfDDFx7IL5SSq/go=");
    expect(result.get("client_id")).toBe("zUpfFsrIEtmAsHLjuGtaEvMqIWecrngz");
    expect(result.get("exp")).toBe("1788788328");
    expect(result.get("ba_iat")).toBe("1788787728684");
    expect(result.getAll("ba_param")).toHaveLength(11);
  });

  it("accepts the search string with or without its leading question mark", () => {
    expect(buildSignedOAuthQuery(SIGNED_SEARCH)).toBe(
      buildSignedOAuthQuery(SIGNED_SEARCH.slice(1)),
    );
  });

  /**
   * The whole reason this filter exists. The provider hashes the canonicalized signed set, so an
   * extra parameter picked up on the way to the page — a locale switch, an analytics tag, a browser
   * extension — would change the input and fail verification with `invalid_signature`.
   */
  it("drops a parameter that was never signed", () => {
    const withExtra = `${SIGNED_SEARCH}&utm_source=newsletter&locale=hu`;
    const result = new URLSearchParams(buildSignedOAuthQuery(withExtra));

    expect(result.has("utm_source")).toBe(false);
    expect(result.has("locale")).toBe(false);
    expect(buildSignedOAuthQuery(withExtra)).toBe(buildSignedOAuthQuery(SIGNED_SEARCH));
  });

  it("preserves a repeated signed parameter", () => {
    const doubled = SIGNED_SEARCH.replace(
      "&resource=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fmcp",
      "&resource=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fmcp&resource=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fother",
    );

    expect(new URLSearchParams(buildSignedOAuthQuery(doubled)).getAll("resource")).toEqual([
      "http://localhost:3000/api/mcp",
      "http://localhost:3000/api/other",
    ]);
  });

  it("returns nothing for a query that carries no signature at all", () => {
    expect(buildSignedOAuthQuery("")).toBe("");
    expect(buildSignedOAuthQuery("?client_id=abc&scope=openid")).toBe("");
    expect(hasSignedOAuthQuery("?client_id=abc")).toBe(false);
  });

  it("returns nothing when the signature is present but nothing names the signed set", () => {
    expect(buildSignedOAuthQuery("?client_id=abc&sig=deadbeef")).toBe("");
  });

  it("recognises a real signed query", () => {
    expect(hasSignedOAuthQuery(SIGNED_SEARCH)).toBe(true);
  });
});
