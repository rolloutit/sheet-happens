/**
 * The signed authorization query that Better Auth's OAuth provider hands to `/login` and `/consent`.
 *
 * When the provider bounces the user to either page it appends the whole authorization request plus
 * `exp`, `ba_iat`, one repeated `ba_param` per signed parameter name, and `sig` — an HMAC over the
 * canonicalized set, keyed with the auth secret. `/oauth2/consent` will only act on a request whose
 * `oauth_query` still verifies against that signature.
 *
 * So the string posted back has to contain **exactly** the signed parameters and nothing else. Any
 * extra query parameter that lands on the page later — an analytics tag, a locale switch, a browser
 * extension — would change the canonicalized input and fail verification with `invalid_signature`.
 *
 * `@better-auth/oauth-provider/client` ships `buildSignedOAuthQuery` for this, but that package is a
 * transitive dependency of `@better-auth/mcp` and is not resolvable from app code, so this is a
 * deliberate re-implementation of the same filter. It lives in `src/lib` with no server imports
 * because both the consent page's client component and the server action need it.
 */

const SIGNATURE_PARAM = "sig";
const SIGNED_NAME_PARAM = "ba_param";

/**
 * Keeps the signature, the list of signed names, and every parameter those names point at.
 *
 * Order and repetition are preserved from the input: the provider canonicalizes before hashing, so
 * ordering is not load-bearing, but a dropped duplicate (`resource` may legitimately repeat) is.
 */
export function buildSignedOAuthQuery(search: string): string {
  const input = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const signedNames = new Set(input.getAll(SIGNED_NAME_PARAM));

  if (signedNames.size === 0 || !input.has(SIGNATURE_PARAM)) {
    return "";
  }

  const output = new URLSearchParams();

  for (const [key, value] of input) {
    if (key === SIGNATURE_PARAM || signedNames.has(key)) {
      output.append(key, value);
    }
  }

  return output.toString();
}

export function hasSignedOAuthQuery(search: string): boolean {
  return buildSignedOAuthQuery(search).length > 0;
}
