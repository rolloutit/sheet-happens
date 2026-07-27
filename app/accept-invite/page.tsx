import { AuthShell } from "@/src/components/layout/AuthShell";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { getSession } from "@/src/server/auth/session";
import { getInvitationAcceptanceDetails } from "@/src/server/users";
import { getTranslations } from "next-intl/server";
import { AcceptInvitationPanel } from "./AcceptInvitationPanel";

type AcceptInvitePageProps = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({ searchParams }: AcceptInvitePageProps) {
  const params = await searchParams;
  const token = getToken(params.token);
  const t = await getTranslations("AcceptInvite");
  const [session, invitation] = await Promise.all([
    getSession(),
    token ? getInvitationAcceptanceDetails(token) : null,
  ]);

  return (
    <AuthShell mood="aboard">
      {token && invitation ? (
        <AcceptInvitationPanel
          token={token}
          email={invitation.email}
          name={invitation.name}
          available={invitation.available}
          expired={invitation.expired}
          status={invitation.status}
          sessionUser={session ? { email: session.user.email } : null}
        />
      ) : (
        <ErrorState
          title={t("error.invalidTitle")}
          message={t("error.invalidMessage")}
          tone="error"
        />
      )}
    </AuthShell>
  );
}

function getToken(token: string | string[] | undefined) {
  if (Array.isArray(token)) {
    return token.at(0) ?? "";
  }

  return token ?? "";
}
