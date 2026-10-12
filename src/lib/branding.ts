/**
 * The one place that decides which organisation the app presents itself as.
 *
 * Sheet Happens is the product; the organisation running it is the deployment's own. With nothing
 * configured the app shows no organisation at all, so a fresh self-hosted install never advertises
 * someone else's name or logo. Set these at build time (`NEXT_PUBLIC_*` is inlined into the client
 * bundle; `docs/self-hosting.md` § Branding lists them next to the PDF logo variable):
 *
 * - `NEXT_PUBLIC_ORG_NAME`      shown under the wordmark, as the logo's alt text and in PDF headers.
 * - `NEXT_PUBLIC_ORG_LOGO`      logo for light surfaces: a `/public` path or an absolute URL.
 * - `NEXT_PUBLIC_ORG_LOGO_DARK` logo for dark surfaces; falls back to `NEXT_PUBLIC_ORG_LOGO`.
 */
export type OrgBranding = {
  name: string | null;
  /** For light surfaces. */
  logo: string | null;
  /** For dark surfaces. */
  logoDark: string | null;
};

function clean(value: string | undefined) {
  return value?.trim() || null;
}

export function resolveOrgBranding(env: {
  name?: string;
  logo?: string;
  logoDark?: string;
}): OrgBranding {
  const logo = clean(env.logo);
  const logoDark = clean(env.logoDark);

  return { name: clean(env.name), logo: logo ?? logoDark, logoDark: logoDark ?? logo };
}

/** Each variable is read by its literal name: Next only inlines `process.env.NEXT_PUBLIC_*` that way. */
export const orgBranding = resolveOrgBranding({
  name: process.env.NEXT_PUBLIC_ORG_NAME,
  logo: process.env.NEXT_PUBLIC_ORG_LOGO,
  logoDark: process.env.NEXT_PUBLIC_ORG_LOGO_DARK,
});
