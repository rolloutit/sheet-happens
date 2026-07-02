import { AppShell } from "@/src/components/layout/AppShell";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { getSession } from "@/src/server/auth/session";
import { getInvitationAcceptanceDetails } from "@/src/server/users";
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
  const [session, invitation] = await Promise.all([
    getSession(),
    token ? getInvitationAcceptanceDetails(token) : null,
  ]);

  return (
    <AppShell role="contractor" current="dashboard" notifications={[]}>
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-4xl place-items-center px-4 py-10 sm:px-6 lg:px-8">
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
            title="Invitation link is invalid"
            message="Ask an admin to send a new invitation from the people page."
            tone="error"
          />
        )}
      </section>
    </AppShell>
  );
}

function getToken(token: string | string[] | undefined) {
  if (Array.isArray(token)) {
    return token.at(0) ?? "";
  }

  return token ?? "";
}
